import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import YouTubeIframe from "react-native-youtube-iframe";
import { engine, YT_STATES } from "../services/audioEngine";
import { getAllTracks } from "../data/tracks";

/**
 * Hidden YouTube provider — real music playback on every platform.
 *
 * Native: react-native-youtube-iframe (a real WebView where injectJavaScript
 * works), driven entirely by props (videoId / play / volume).
 *
 * Web: the library's web transport is broken (react-native-web-webview has no
 * injectJavaScript method and its postMessage is sent without a targetOrigin,
 * so cross-origin commands to the YouTube host are silently dropped — which is
 * why web playback silently fell back to the synth preview). This module
 * therefore drives YouTube's official IFrame Player API directly on web: a
 * hidden /embed iframe plus the documented JSON postMessage protocol, which
 * works cross-origin. Same engine-facing surface as native.
 */
export default function YoutubeBridge() {
  return Platform.OS === "web" ? <WebYoutubeBridge /> : <NativeYoutubeBridge />;
}

/* ------------------------------------------------------------------ */
/*  Native — react-native-youtube-iframe (props-driven WebView)        */
/* ------------------------------------------------------------------ */

function NativeYoutubeBridge() {
  const ref = useRef(null);
  const [videoId, setVideoId] = useState(null);
  const [play, setPlay] = useState(false);
  const [volume, setVolume] = useState(1);
  const [ready, setReady] = useState(false);

  // Cache the engine reads synchronously. States are stored as the engine's
  // string names (YT_STATES) so both platforms speak the same language.
  const cache = useRef({ time: 0, duration: 0, state: YT_STATES.UNSTARTED });
  // The engine assigns onReady/onStateChange/onError onto this object.
  const callbacks = useRef({});

  useEffect(() => {
    const bridge = {
      onReady: null, // assigned by the engine
      onStateChange: null, // assigned by the engine
      onError: null, // assigned by the engine
      setVideoId: (id) => {
        cache.current.time = 0;
        setVideoId(id || null);
      },
      setPlay: (p) => setPlay(Boolean(p)),
      setVolume: (v) => setVolume(Math.max(0, Math.min(1, v))),
      seekTo: (sec) => {
        if (ref.current) {
          try {
            ref.current.seekTo(sec, true);
          } catch {
            /* noop */
          }
        }
        cache.current.time = sec;
      },
      getCurrentTime: () => cache.current.time,
      getDuration: () => cache.current.duration,
      getState: () => cache.current.state,
      destroy: () => {
        cache.current.time = 0;
        cache.current.duration = 0;
        setPlay(false);
      },
    };
    callbacks.current = bridge;
    engine.registerYoutubeBridge(bridge);
  }, []);

  // Poll time/duration into the sync cache while ready. Each poll is a WebView
  // round-trip (injectJavaScript + postMessage), which is expensive on native,
  // so it runs at 500ms and only while the embed is actually playing; the
  // duration is only fetched until it's known. Position updates at 2Hz are
  // smoothed by the progress bars' Reanimated easing, so playback still looks
  // buttery without the bridge traffic.
  useEffect(() => {
    if (!ready || !play) return;
    const iv = setInterval(() => {
      if (!ref.current) return;
      ref.current
        .getCurrentTime()
        .then((t) => {
          if (Number.isFinite(t)) cache.current.time = t;
        })
        .catch(() => {});
      if (cache.current.duration <= 0) {
        ref.current
          .getDuration()
          .then((d) => {
            if (d > 0) cache.current.duration = d;
          })
          .catch(() => {});
      }
    }, 500);
    return () => clearInterval(iv);
  }, [ready, play]);

  return (
    <View style={[styles.host, { pointerEvents: "none" }]} collapsable={false}>
      <YouTubeIframe
        ref={ref}
        height={200}
        width={200}
        videoId={videoId || undefined}
        play={play}
        volume={Math.round(volume * 100)}
        mute={false}
        forceAndroidAutoplay
        initialPlayerParams={{
          controls: false,
          rel: false,
          iv_load_policy: 3,
          cc_lang_pref: "en",
        }}
        onReady={() => {
          setReady(true);
          cache.current.state = YT_STATES.UNSTARTED;
          // Tell the engine the embed is ready. The engine assigns
          // callbacks.current.onReady in registerYoutubeBridge; if that
          // hasn't run yet (mount race), retry a tick later.
          if (callbacks.current.onReady) callbacks.current.onReady();
          else setTimeout(() => callbacks.current.onReady?.(), 50);
        }}
        onChangeState={(state) => {
          // The library reports numeric states; map them to the engine's
          // string names so native and web speak the same language (the
          // engine compares against YT_STATES strings).
          const mapped = STATE_MAP[state];
          if (mapped) cache.current.state = mapped;
          // Only forward the meaningful ones to the engine.
          if (state === 1 || state === 2 || state === 0) {
            callbacks.current.onStateChange?.(mapped);
          }
        }}
        onError={() => callbacks.current.onError?.()}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Web — official YouTube IFrame Player API (direct postMessage)      */
/* ------------------------------------------------------------------ */

const YT_EMBED = "https://www.youtube.com/embed/";

// Numeric IFrame API player states → the engine's string states (YT_STATES,
// the single source of truth in audioEngine), so the engine logic is
// platform-agnostic. Used by both the native and web paths.
const STATE_MAP = {
  [-1]: YT_STATES.UNSTARTED,
  0: YT_STATES.ENDED,
  1: YT_STATES.PLAYING,
  2: YT_STATES.PAUSED,
  3: YT_STATES.BUFFERING,
  5: YT_STATES.CUED,
};

/** Send one documented IFrame-API command to the hidden embed. */
function postCommand(frame, func, args = []) {
  if (!frame?.contentWindow) return;
  try {
    // "*" target: commands are dispatched while the embed is still loading
    // (contentWindow is about:blank, same-origin), so a strict
    // "https://www.youtube.com" target throws an origin-mismatch DOMException
    // for every early command. The IFrame API ignores the target origin — it
    // only reads the message payload — so "*" is safe and never errors.
    frame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  } catch {
    /* noop */
  }
}

function WebYoutubeBridge() {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const cache = useRef({ time: 0, duration: 0, state: YT_STATES.UNSTARTED });
  const callbacks = useRef({});
  // The id the engine wants vs. the id actually loaded in the player. Kept as
  // refs so commands can be replayed once the player becomes ready.
  const desiredRef = useRef(null);
  const loadedRef = useRef(null);
  // The id baked into the iframe URL — fixed on first mount (the embed loads
  // it itself), every later track switch goes through loadVideoById so the
  // iframe never reloads. Warm up with the first library track, like native.
  const [mountId, setMountId] = useState(() => getAllTracks()[0]?.youtubeId || null);
  const [play, setPlay] = useState(false);
  const [volume, setVolume] = useState(1);
  const [ready, setReady] = useState(false);

  const post = useCallback((func, args) => postCommand(iframeRef.current, func, args), []);

  // Create the hidden embed once (imperatively — RN-web doesn't render raw
  // iframes). Commands to it go through postMessage; nothing needs eval.
  useEffect(() => {
    if (!mountId) return;
    const origin = typeof location !== "undefined" && /^https?:/.test(location.origin) ? location.origin : "";
    const src =
      `${YT_EMBED}${encodeURIComponent(mountId)}` +
      "?enablejsapi=1&autoplay=1&playsinline=1&rel=0&controls=0&iv_load_policy=3&modestbranding=1" +
      (origin ? `&origin=${encodeURIComponent(origin)}` : "");
    const frame = document.createElement("iframe");
    frame.src = src;
    // The `allow` attribute covers fullscreen; also setting `allowfullscreen`
    // just triggers a console warning that `allow` takes precedence.
    frame.allow = "autoplay; encrypted-media; fullscreen";
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "200px",
      height: "200px",
      opacity: "0.01",
      pointerEvents: "none",
      border: "0",
    });
    iframeRef.current = frame;
    containerRef.current?.appendChild(frame);
    return () => {
      frame.remove();
      iframeRef.current = null;
    };
  }, [mountId]);

  // Engine-facing bridge (same surface as native).
  useEffect(() => {
    const bridge = {
      onReady: null, // assigned by the engine
      onStateChange: null, // assigned by the engine
      onError: null, // assigned by the engine
      setVideoId: (id) => {
        const vid = id || null;
        cache.current.time = 0;
        desiredRef.current = vid;
        if (!vid) return;
        if (!iframeRef.current) {
          // No embed yet — mount one with this id (the URL loads it itself).
          loadedRef.current = vid;
          setMountId(vid);
          return;
        }
        if (ready && loadedRef.current !== vid) {
          loadedRef.current = vid;
          post("loadVideoById", [vid, 0, "default"]);
        }
      },
      setPlay: (p) => setPlay(Boolean(p)),
      setVolume: (v) => setVolume(Math.max(0, Math.min(1, v))),
      seekTo: (sec) => {
        post("seekTo", [sec, true]);
        cache.current.time = sec;
      },
      getCurrentTime: () => cache.current.time,
      getDuration: () => cache.current.duration,
      getState: () => cache.current.state,
      destroy: () => {
        cache.current.time = 0;
        cache.current.duration = 0;
        setPlay(false);
      },
    };
    callbacks.current = bridge;
    engine.registerYoutubeBridge(bridge);
  }, [post, ready]);

  // Message listener — player → app (events + info delivery).
  useEffect(() => {
    const onMessage = (e) => {
      if (!e.origin || !e.origin.includes("youtube.com")) return;
      const data = e.data;
      if (!data || typeof data !== "object" || !data.event) return;
      const cbs = callbacks.current;
      switch (data.event) {
        case "onReady": {
          setReady(true);
          cache.current.state = YT_STATES.UNSTARTED;
          // If a track was requested before the player finished creating
          // (commands sent too early are dropped), load it now.
          if (desiredRef.current && loadedRef.current !== desiredRef.current) {
            loadedRef.current = desiredRef.current;
            post("loadVideoById", [desiredRef.current, 0, "default"]);
          }
          // The engine assigns cbs.onReady in registerYoutubeBridge; effects
          // run synchronously at mount while this message arrives over the
          // network, so the callback is always registered by the time the
          // embed reports ready.
          cbs.onReady?.();
          break;
        }
        case "onStateChange": {
          const mapped = STATE_MAP[data.info?.data];
          if (mapped) cache.current.state = mapped;
          if (data.info?.data === 1 || data.info?.data === 2 || data.info?.data === 0) {
            cbs.onStateChange?.(mapped);
          }
          break;
        }
        case "onError":
          cbs.onError?.();
          break;
        case "infoDelivery":
          if (Number.isFinite(data.info?.currentTime)) cache.current.time = data.info.currentTime;
          if (Number.isFinite(data.info?.duration) && data.info.duration > 0) cache.current.duration = data.info.duration;
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [post]);

  // Play/pause + volume commands (sent whenever the engine changes them).
  useEffect(() => {
    post(play ? "playVideo" : "pauseVideo", []);
  }, [play, post]);

  useEffect(() => {
    post("setVolume", [Math.round(volume * 100)]);
    post(volume === 0 ? "mute" : "unMute", []);
  }, [volume, post]);

  // Poll time/duration into the sync cache while playing (same cadence as
  // native: 500ms, duration only until known).
  useEffect(() => {
    if (!ready || !play) return;
    const iv = setInterval(() => {
      post("getCurrentTime", []);
      if (cache.current.duration <= 0) post("getDuration", []);
    }, 500);
    return () => clearInterval(iv);
  }, [ready, play, post]);

  return <View style={[styles.host, { pointerEvents: "none" }]} collapsable={false} ref={containerRef} />;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: -1000,
    top: -1000,
    width: 200,
    height: 200,
    opacity: 0.01,
    zIndex: -100,
  },
});
