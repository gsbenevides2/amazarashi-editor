import Link from "next/link";
import { notFound } from "next/navigation";
import SongForm from "../../_components/SongForm";
import { getSong } from "../../_actions/songs";

type Props = { params: Promise<{ songId: string }> };

export const dynamic = "force-dynamic";

export default async function EditSongPage({ params }: Props) {
  const { songId } = await params;
  const song = await getSong(songId);

  if (!song) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href="/songs"
          className="text-neutral-400 hover:text-white text-sm"
        >
          ← Músicas
        </Link>
        <span className="text-neutral-600">/</span>
        <h1 className="font-bold text-2xl">{song.nameRomaji}</h1>
      </div>

      <div className="flex gap-3 mb-6">
        <Link
          href={`/songs/${songId}/lyrics`}
          className="bg-neutral-700 hover:bg-neutral-600 px-4 py-1.5 rounded text-sm"
        >
          Editor de Letras
        </Link>
        <Link
          href={`/songs/${songId}/sync`}
          className="bg-neutral-700 hover:bg-neutral-600 px-4 py-1.5 rounded text-sm"
        >
          Sincronização
        </Link>
      </div>

      <SongForm
        songId={songId}
        initialData={{
          nameRomaji: song.nameRomaji,
          nameHiragana: song.nameHiragana,
          nameEnglish: song.nameEnglish,
          namePortuguese: song.namePortuguese,
          duration: song.duration,
          youtubeVideoClipId: song.youtubeVideoClipId,
          youtubeMusicId: song.youtubeMusicId,
          spotifyId: song.spotifyId,
          videoClipCoverUrl: song.videoClipCoverUrl,
          description: song.description,
          releaseDate: song.releaseDate,
        }}
        albums={song.albums}
      />
    </div>
  );
}
