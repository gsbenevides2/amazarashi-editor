import Link from "next/link";
import { notFound } from "next/navigation";
import AlbumForm from "../../_components/AlbumForm";
import { getAlbum } from "../../_actions/albums";
import { getSongs } from "../../_actions/songs";

type Props = { params: Promise<{ albumId: string }> };

export const dynamic = "force-dynamic";

export default async function EditAlbumPage({ params }: Props) {
  const { albumId } = await params;
  const [album, songs] = await Promise.all([getAlbum(albumId), getSongs()]);

  if (!album) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/albums"
          className="text-neutral-400 hover:text-white text-sm"
        >
          ← Álbuns
        </Link>
        <span className="text-neutral-600">/</span>
        <h1 className="font-bold text-2xl">{album.nameRomaji}</h1>
      </div>

      <AlbumForm
        albumId={albumId}
        initialData={{
          nameRomaji: album.nameRomaji,
          nameHiragana: album.nameHiragana,
          nameEnglish: album.nameEnglish,
          namePortuguese: album.namePortuguese,
          image: album.image,
          releaseDate: album.releaseDate,
        }}
        initialSongIds={album.songs.map((s) => s.id)}
        allSongs={songs}
      />
    </div>
  );
}
