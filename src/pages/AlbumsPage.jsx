import { Disc3 } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import { AlbumCard, CardGrid } from "../components/CollectionCards";
import Artwork from "../components/Artwork";
import CollectionDetail from "../components/CollectionDetail";
import { pluralize, formatListDuration } from "../utils/format";

export default function AlbumsPage() {
  const params = useLocalSearchParams();
  const name = typeof params.name === "string" ? params.name : undefined;
  const { albums } = usePlayer();

  if (name) {
    return (
      <CollectionDetail
        list={albums}
        name={name}
        icon={Disc3}
        eyebrow="Album"
        backLabel="Albums"
        backTo="/albums"
        emptyTitle="Album not found"
        emptyMessage="This album isn't in your library."
        artwork={(item) => <Artwork src={item.thumbnail} alt="" gradient={item.gradient} size={140} rounded={18} />}
        meta={(item, tracks) =>
          `${item.artist} · ${pluralize(tracks.length, "song")} · ${formatListDuration(tracks.reduce((s, tr) => s + tr.duration, 0))}`
        }
      />
    );
  }

  return (
    <Page>
      <PageHeader eyebrow="Your library" title="Albums" sub="The records behind your playlist." />
      <CardGrid>
        {albums.map((a) => (
          <AlbumCard key={a.name} album={a} />
        ))}
      </CardGrid>
    </Page>
  );
}
