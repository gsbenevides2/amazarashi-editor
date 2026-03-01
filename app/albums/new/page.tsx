import Link from "next/link";
import AlbumForm from "../../_components/AlbumForm";
import { getSongs } from "../../_actions/songs";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage() {
  const songs = await getSongs();

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
        <h1 className="font-bold text-2xl">Novo Álbum</h1>
      </div>
      <AlbumForm allSongs={songs} />
    </div>
  );
}
