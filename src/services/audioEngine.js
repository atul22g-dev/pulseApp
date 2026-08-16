/**
 * audioEngine — provider-agnostic playback engine (port of the web app's
 * src/services/audioEngine.js). Same stable surface:
 *
 *   load / play / pause / seekTo / setVolume / getPosition / getDuration /
 *   fadeIn / fadeOut / initYouTube / registerYoutubeBridge /
 *   onEnded / onError / onMessage / onProviderChange
 *
 * Two providers, same as the web app:
 *  1. "youtube" — real playback through YouTube's official embed, via
 *     react-native-youtube-iframe (a WebView + the IFrame Player API). The
 *     UI never touches it directly; the engine talks to a hidden
 *     <YoutubeBridge/> that renders off-screen and mirrors the props.
 *  2. "synth"   — a fallback that plays an ORIGINAL ambient composition
 *     seeded per track. The web version synthesized live with Web Audio; on
 *     native the same composition is rendered offline to a WAV (see
 *     synthRenderer.js) and played through expo-audio, which also provides
 *     background playback + lock-screen controls.
 */

import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { clamp, hashString } from "../utils/misc";
import { ensureSynthWav, cachedSynthUri } from "./synthRenderer";

// How long the embed gets to actually start playing before we fall back to the
// synth preview. Generous on purpose: a cold WebView + slow network can take
// well over ten seconds just to load the player and buffer the stream, and a
// premature fallback is what makes "the real song never plays" (the preview
// keeps taking over). Genuine embed errors still fall back instantly.
const YT_START_TIMEOUT_MS = 15000;
// After a track falls back, wait this long before trying YouTube for it again —
// a transient slow start must not exile the track to the preview forever.
const YT_RETRY_COOLDOWN_MS = 30000;

/** Player state names shared with the YoutubeBridge (single source of truth). */
export const YT_STATES = {
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended",
  BUFFERING: "buffering",
  UNSTARTED: "unstarted",
  CUED: "video cued",
};

// expo-audio's own player for the synth provider + lock-screen binding.
setAudioModeAsync({
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: "doNotMix",
}).catch(() => {});

class AudioEngine {
  constructor() {
    // synth provider (native = expo-audio playing a rendered WAV)
    this._audioPlayer = null;
    this._synthUri = null;
    this._playToken = 0;
    this._pendingSynthStart = null;
    this._lockScreenActive = false;
    this._synthSub = null;
    this._synthStatus = null; // { currentTime, duration, playing }
    this._position = 0;
    this._fading = false;
    this._seed = 0;
    this._progression = null;

    // shared state
    this.track = null;
    this.playing = false;
    this._volume = 0.8;
    this.provider = "synth";

    // youtube provider (bridge = hidden <YoutubeBridge/>)
    this._yt = null;
    this.youtubeReady = false;
    this.youtubeAvailable = null; // null = unknown, true = ok, false = failed
    this.youtubeFailed = false;
    this._ytFailAt = 0; // when the embed last failed to init (for retry cooldown)
    this._ytFailedFor = null; // track id that already fell back (with cooldown)
    this._ytFailedAt = 0; // when that track fell back (for the retry cooldown)
    this._ytCuedId = null;
    this._pendingPlay = false;
    this._apiPromise = null;
    this._settleYt = null;
    this._ytVerifyTimer = null;
    this._ytHadPlayed = false; // has the embed actually started this track?
    this._ytErrorFor = null; // track id of the most recent (maybe spurious) embed error
    this._ytErrorAt = 0; // when that error arrived (for the repeated-error check)

    // callbacks
    this.onEnded = null;
    this.onError = null;
    this.onMessage = null;
    this.onProviderChange = null;
    this.onStateChange = null;
  }

  /* ------------------------------------------------------------------ */
  /*  YouTube IFrame provider                                            */
  /* ------------------------------------------------------------------ */

  /**
   * The hidden <YoutubeBridge/> React component calls registerYoutubeBridge
   * once mounted; from then on the engine drives playback through it.
   */
  registerYoutubeBridge(bridge) {
    this._yt = bridge;
    bridge.onReady = () => {
      this.youtubeReady = true;
      this.youtubeAvailable = true;
      // A late-ready (e.g. the embed was slow to load after the warm-up
      // timed out) re-enables YouTube for subsequent loads.
      this.youtubeFailed = false;
      try {
        bridge.setVolume(this._volume);
      } catch {
        /* noop */
      }
      if (this._settleYt) {
        this._settleYt(true);
        this._settleYt = null;
      }
      if (this._pendingPlay) {
        this._pendingPlay = false;
        this._ytStart();
      }
    };
    bridge.onStateChange = (state) => this._onYtState(state);
    bridge.onError = () => this._onYtError();
  }

  initYouTube() {
    if (this.youtubeAvailable === false || this.youtubeFailed) return Promise.resolve(false);
    if (this._apiPromise) return this._apiPromise;
    if (this._yt && this.youtubeReady) return Promise.resolve(true);

    this._apiPromise = new Promise((resolve) => {
      // Safety net: if the hidden player never becomes ready (offline,
      // WebView unavailable), stop waiting and fall back to the synth.
      let timer;
      const settle = (ok) => {
        clearTimeout(timer);
        if (this._settleYt) this._settleYt = null;
        resolve(ok);
      };
      this._settleYt = settle;
      timer = setTimeout(() => {
        if (!this.youtubeReady) {
          this.youtubeAvailable = false;
          this.youtubeFailed = true;
          this._ytFailAt = Date.now();
          this._pendingPlay = false;
          settle(false);
        }
      }, 8000);
      // Already registered + ready before init was called.
      if (this._yt && this.youtubeReady) settle(true);
    });
    return this._apiPromise;
  }

  _onYtState(state) {
    if (__DEV__) console.log("[dbg] ytState", state, "prov:", this.provider, "playing:", this.playing);
    // Only the YouTube provider's events count. Once playback has fallen back
    // to the preview, the embed's state changes are just echoes of our own
    // setPlay(false) — honoring them would flip the app to "paused" while the
    // preview audio keeps playing (and could double-advance on ENDED).
    if (this.provider !== "youtube") return;
    if (state === YT_STATES.PLAYING) {
      this._ytHadPlayed = true;
      if (!this.playing) {
        this.playing = true;
        this._emit();
      }
    } else if (state === YT_STATES.PAUSED) {
      if (this.playing) {
        this.playing = false;
        this._emit();
      }
    } else if (state === YT_STATES.ENDED) {
      if (this.playing) {
        this.playing = false;
        this._emit();
      }
      this._position = 0;
      if (this.onEnded) this.onEnded();
    }
  }

  _onYtError() {
    if (__DEV__) console.log("[dbg] ytError", this.track?.id, "hadPlayed:", this._ytHadPlayed, "errFor:", this._ytErrorFor, "repeated:", !!this.track && this._ytErrorFor === this.track.id && Date.now() - this._ytErrorAt < 5000);
    // The embed in this environment frequently fires a spurious error (code 2,
    // invalid_parameter) right after loadVideoById — yet the video loads and
    // plays normally a moment later. Treating that as a hard failure falls back
    // to the preview, whose audio-focus request then PAUSES the real video that
    // was about to start. So only fall back immediately when the failure is
    // clearly real: the video was already playing and died, or a retry ALSO
    // errored. A first error while the video is still starting is ignored and
    // the start-verify window decides (it still falls back if the video never
    // plays within YT_START_TIMEOUT_MS).
    const t = this.track;
    const repeated =
      !!t && this._ytErrorFor === t.id && Date.now() - this._ytErrorAt < 5000;
    if (t?.youtubeId && !this._ytHadPlayed && !repeated) {
      this._ytErrorFor = t.id;
      this._ytErrorAt = Date.now();
      return;
    }
    // A per-video error (embed disabled, region block, …) falls back for THIS
    // track only — it must not disable YouTube for the whole session, or one
    // blocked video would force every later song to the synth preview. The
    // cooldown still lets a later play retry YouTube (some errors are transient).
    this._ytFailedFor = t?.id || null;
    this._ytFailedAt = Date.now();
    const wasPending = this._pendingPlay;
    const wasPlaying = this.playing;
    this._pendingPlay = false;
    if (this.provider === "youtube") {
      this.provider = "synth";
      if (this.onProviderChange) this.onProviderChange("synth");
    }
    this.playing = false;
    // Fall back to the synth provider whether the video was still starting
    // (pending) or failed mid-playback.
    if (t && (wasPending || wasPlaying)) {
      this._loadSynth(t);
      this._playSynth();
    }
    if (this.onMessage) {
      this.onMessage("This video can't be played here — using preview audio instead.");
    }
    this._emit();
  }

  _ytEligible(track) {
    // Only a fundamental failure (embed unavailable) disqualifies YouTube;
    // "unknown" (youtubeAvailable null) still gets a chance at play time.
    if (!track?.youtubeId || this.youtubeFailed) return false;
    // A track that already fell back gets a fresh YouTube attempt after a
    // cooldown — a slow cold start must not exile it to the preview forever.
    if (this._ytFailedFor === track.id && Date.now() - this._ytFailedAt < YT_RETRY_COOLDOWN_MS) {
      return false;
    }
    return true;
  }

  _ytStart() {
    const t = this.track;
    if (!t?.youtubeId) {
      this._fallbackToSynth("This video can't be played here — using preview audio instead.");
      return;
    }
    const b = this._yt;
    if (!b || !this.youtubeReady) {
      this._fallbackToSynth("YouTube isn't ready — using preview audio instead.", true);
      return;
    }
    this._pendingPlay = false;
    this._ytCuedId = t.youtubeId;
    // Fresh attempt: the previous error/spurious-error state is for the old
    // play, not this one.
    this._ytHadPlayed = false;
    this._ytErrorFor = null;
    this._ytErrorAt = 0;
    // Real playback is taking over — stop the preview so the two never overlap.
    this._pauseSynth();
    b.setVideoId(t.youtubeId);
    b.setPlay(true);
    this.playing = true;
    this._emit();
    this._ytVerifyStart();
  }

  /**
   * Start verification: keep an eye on the embed until it actually starts.
   * The embed announces its own state when it begins, so a real player clears
   * this immediately; we only fall back to the synth provider when it has
   * silently stalled for the whole YT_START_TIMEOUT_MS window (cold WebView
   * load, buffering, autoplay policy) — never on a slow-but-progressing start.
   * Genuine embed errors still fall back instantly via _onYtError.
   */
  _ytVerifyStart() {
    clearTimeout(this._ytVerifyTimer);
    const deadline = Date.now() + YT_START_TIMEOUT_MS;
    const check = () => {
      if (!this.playing || !this.youtubeReady || !this._yt) return;
      const st = this._yt.getState();
      if (__DEV__) console.log("[dbg] verify", st, "pos:", this._yt.getCurrentTime());
      if (st === YT_STATES.PLAYING || st === YT_STATES.BUFFERING) return;
      if (Date.now() >= deadline) {
        // Slow start, not a hard error — do NOT remember the track, so the
        // next play retries YouTube (the embed is warm by then and starts fast).
        this._fallbackToSynth("YouTube couldn't start this video — using preview audio instead.");
        return;
      }
      // Still loading — nudge autoplay and re-check shortly.
      try {
        this._yt.setPlay(true);
      } catch {
        /* noop — the next check falls back when the deadline passes */
      }
      this._ytVerifyTimer = setTimeout(check, 2000);
    };
    this._ytVerifyTimer = setTimeout(check, 2000);
  }

  _fallbackToSynth(message, remember = false) {
    if (__DEV__) console.log("[dbg] fallbackToSynth", this.track?.id, "remember:", remember, "msg:", message);
    // remember=true is only for HARD failures (embed error, YouTube
    // unavailable): it routes an immediate resume straight to the synth
    // instead of stalling again, for the retry cooldown. Slow starts don't
    // remember — the embed is warm on the next play and starts quickly.
    if (remember) {
      this._ytFailedFor = this.track?.id || null;
      this._ytFailedAt = Date.now();
    }
    if (this._yt && this.youtubeReady) {
      try {
        this._yt.setPlay(false);
      } catch {
        /* noop */
      }
    }
    if (this.provider !== "synth") {
      this.provider = "synth";
      if (this.onProviderChange) this.onProviderChange("synth");
    }
    this._pendingPlay = false;
    if (this.track) {
      this._loadSynth(this.track);
      this._playSynth();
    }
    if (message && this.onMessage) this.onMessage(message);
  }

  /* ------------------------------------------------------------------ */
  /*  Public surface                                                     */
  /* ------------------------------------------------------------------ */

  load(track) {
    clearTimeout(this._ytVerifyTimer);
    this.track = track;
    this._seed = track ? hashString(String(track?.id || "")) : 0;
    this._progression = null;
    this._position = 0;
    this._ytFailedFor = null; // a new track gets a fresh YouTube attempt
    this._ytFailedAt = 0;
    this._ytHadPlayed = false;
    this._ytErrorFor = null;
    this._ytErrorAt = 0;
    const provider = this._ytEligible(track) ? "youtube" : "synth";
    if (provider !== this.provider) {
      this.provider = provider;
      if (this.onProviderChange) this.onProviderChange(provider);
    }
    this._emit();
  }

  play() {
    if (!this.track) return;
    // After a fundamental failure, give YouTube a fresh chance on later plays
    // (a slow first boot shouldn't disable real music for the whole session).
    if (this.youtubeFailed && Date.now() - this._ytFailAt > 15000) {
      this.youtubeFailed = false;
      this.youtubeAvailable = null;
    }
    // Try YouTube for this track unless it fell back within the retry cooldown
    // (that check lives inside _ytEligible).
    if (this._ytEligible(this.track)) {
      if (this.provider !== "youtube") {
        this.provider = "youtube";
        if (this.onProviderChange) this.onProviderChange("youtube");
      }
      if (this.youtubeReady && this._yt) {
        this._pendingPlay = false;
        this._ytStart();
      } else {
        // The mount-time warm-up may have timed out before the embed
        // finished loading, so give YouTube one more chance per play. Never
        // leave the user in silence either way: start rendering the synth
        // preview in parallel so the fallback is instant.
        this.youtubeFailed = false;
        this.youtubeAvailable = null;
        this._pendingPlay = true;
        this._warmSynth();
        this.initYouTube().then((ok) => {
          if (!ok) {
            // The user may have paused while the embed was booting — only fall
            // back if they still want to play.
            if (this._pendingPlay) {
              this._fallbackToSynth("YouTube is unavailable — using preview audio instead.", true);
            }
            return;
          }
          if (this.provider !== "youtube" || !this.youtubeReady || !this._yt) return;
          // A pause while the embed was loading cancels the pending play.
          if (!this._pendingPlay) return;
          this._pendingPlay = false;
          this._ytStart();
        });
      }
      return;
    }
    this._playSynth();
  }

  /**
   * Pre-render the synth preview for the current track so a YouTube fallback
   * can start instantly instead of after another render. Never throws.
   */
  _warmSynth() {
    if (!this.track || cachedSynthUri(this.track)) return;
    ensureSynthWav(this.track).catch(() => {});
  }

  pause() {
    clearTimeout(this._ytVerifyTimer);
    // Cancel any play that is still waiting for the embed to finish booting —
    // a pause is a pause, even before the video starts.
    this._pendingPlay = false;
    if (this.provider === "youtube" && this.youtubeReady && this._yt) {
      try {
        this._yt.setPlay(false);
      } catch {
        /* noop */
      }
      // If a preview track is somehow still running underneath (a fallback
      // that raced a resume), stop it too — the user asked for silence.
      this._pauseSynth();
      this.playing = false;
      this._emit();
      return;
    }
    this._pauseSynth();
  }

  seekTo(seconds) {
    if (!this.track || !Number.isFinite(seconds)) return;
    const target = clamp(seconds, 0, this.track.duration || seconds);
    if (this.provider === "youtube" && this.youtubeReady && this._yt) {
      try {
        this._yt.seekTo(target);
      } catch {
        /* noop */
      }
      this._position = target;
      this._emit();
      return;
    }
    this._seekSynth(target);
  }

  getPosition() {
    if (this.provider === "youtube" && this._yt) {
      return this._yt.getCurrentTime();
    }
    return this._synthStatus?.currentTime ?? this._position;
  }

  getDuration() {
    if (this.provider === "youtube" && this._yt) {
      const d = this._yt.getDuration();
      if (d > 0) return d;
    }
    return this._synthStatus?.duration || this.track?.duration || 0;
  }

  setVolume(volume) {
    this._volume = clamp(volume, 0, 1);
    if (this._yt && this.youtubeReady) {
      try {
        this._yt.setVolume(this._volume);
      } catch {
        /* noop */
      }
    }
    if (this._audioPlayer) {
      this._audioPlayer.volume = this._volume;
    }
  }

  /**
   * Fade the synth player's volume (no-op for YouTube — used for crossfade).
   * Returns a promise that resolves when the fade completes.
   */
  fadeOut(duration = 0.18) {
    const p = this._audioPlayer;
    if (!p || this.provider !== "synth") return Promise.resolve();
    this._fading = true;
    return new Promise((resolve) => {
      const steps = Math.max(4, Math.round(duration / 0.05));
      const start = p.volume;
      let i = 0;
      const iv = setInterval(() => {
        i++;
        const t = i / steps;
        p.volume = start * (1 - t);
        if (i >= steps) {
          clearInterval(iv);
          p.volume = 0.0001;
          this._fading = false;
          resolve();
        }
      }, (duration / steps) * 1000);
    });
  }

  fadeIn(duration = 0.25) {
    const p = this._audioPlayer;
    if (!p || this.provider !== "synth") return;
    const steps = Math.max(5, Math.round(duration / 0.05));
    const target = this._volume;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      p.volume = target * (i / steps);
      if (i >= steps) {
        clearInterval(iv);
        p.volume = target;
        this._fading = false;
      }
    }, (duration / steps) * 1000);
  }

  /* ------------------------------------------------------------------ */
  /*  Synth provider internals (expo-audio)                              */
  /* ------------------------------------------------------------------ */

  _ensureSynthPlayer() {
    if (this._audioPlayer) return this._audioPlayer;
    const player = createAudioPlayer(null, { updateInterval: 250 });
    this._synthSub = player.addListener("playbackStatusUpdate", (s) => {
      this._synthStatus = {
        currentTime: s.currentTime || 0,
        duration: s.duration || 0,
        playing: s.playing,
      };
      if (this._pendingSynthStart && s.duration > 0) {
        const fn = this._pendingSynthStart;
        this._pendingSynthStart = null;
        fn();
      }
      if (s.didJustFinish && this.playing && this.provider === "synth") {
        this.playing = false;
        this._position = 0;
        this._emit();
        if (this.onEnded) this.onEnded();
      }
    });
    this._audioPlayer = player;
    return player;
  }

  _loadSynth(track) {
    this.track = track;
    this._seed = track ? hashString(String(track?.id || "")) : 0;
    this._position = 0;
    this._emit();
  }

  async _playSynth() {
    if (!this.track) return;
    const player = this._ensureSynthPlayer();
    const token = ++this._playToken;
    // Quick-path: already rendered for this track.
    let uri = cachedSynthUri(this.track);
    if (!uri) {
      try {
        uri = await ensureSynthWav(this.track);
      } catch {
        if (this.onError) this.onError("Couldn't generate preview audio for this track.");
        return;
      }
    }
    // The user may have paused or switched tracks while we rendered.
    if (token !== this._playToken || this.provider !== "synth" || !this.track) return;
    if (this._synthUri !== uri) {
      player.replace({ uri });
      this._synthUri = uri;
      this._synthStatus = null;
      player.volume = this._volume;
      this._updateLockScreen();
    }

    const start = () => {
      player.volume = this._volume;
      const target = Math.max(0, this._position);
      player
        .seekTo(target > 0.05 ? target : 0)
        .then(() => {
          if (this.playing && this.provider === "synth") player.play();
        })
        .catch(() => {});
    };

    this.playing = true;
    if (this._synthStatus && this._synthStatus.duration > 0) {
      start();
    } else {
      // Wait for the file to load (first status with duration) before starting.
      this._pendingSynthStart = start;
      setTimeout(() => {
        if (this._pendingSynthStart && this._synthStatus?.duration > 0) {
          this._pendingSynthStart = null;
          start();
        }
      }, 700);
    }
    this._emit();
  }

  _pauseSynth() {
    const p = this._audioPlayer;
    if (!p) return;
    this._position = this._synthStatus?.currentTime ?? this._position;
    this.playing = false;
    this._pendingSynthStart = null;
    try {
      p.pause();
    } catch {
      /* noop */
    }
    this._emit();
  }

  _seekSynth(target) {
    if (!Number.isFinite(target)) return;
    this._position = target;
    const p = this._audioPlayer;
    if (p && this._synthStatus?.duration > 0) {
      try {
        p.seekTo(target);
      } catch {
        /* noop */
      }
    }
    this._emit();
  }

  _updateLockScreen() {
    const p = this._audioPlayer;
    if (!p || this.provider !== "synth" || !this.track) return;
    const meta = {
      title: this.track.title || "",
      artist: this.track.artist || "",
      albumTitle: this.track.album || "",
      artworkUrl: this.track.thumbnail || undefined,
    };
    try {
      if (this._lockScreenActive) {
        p.updateLockScreenMetadata(meta);
      } else {
        p.setActiveForLockScreen(true, meta);
        this._lockScreenActive = true;
      }
    } catch {
      /* lock screen unavailable */
    }
  }

  _emit() {
    if (this.onStateChange) {
      this.onStateChange({ playing: this.playing, position: this.getPosition() });
    }
  }
}

export const engine = new AudioEngine();
