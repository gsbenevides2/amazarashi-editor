import Link from "next/link";
import { notFound } from "next/navigation";
import { getSong } from "../../../_actions/songs";
import { getLyrics, getLanguages } from "../../../_actions/lyrics";
import LyricsSynchronization from "../../../_components/LyricsSynchronization";

type Props = { params: Promise<{ songId: string }> };

export const dynamic = "force-dynamic";

export default async function SyncPage({ params }: Props) {
  const { songId } = await params;
  const [song, lyrics, languages] = await Promise.all([
    getSong(songId),
    getLyrics(songId),
    getLanguages(),
  ]);

  if (!song) notFound();

  if (lyrics.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/songs/${songId}`}
            className="text-neutral-400 hover:text-white text-sm"
          >
            ← {song.nameRomaji}
          </Link>
          <span className="text-neutral-600">/</span>
          <h1 className="font-bold text-2xl">Sincronização</h1>
        </div>
        <p className="text-neutral-400">
          Nenhuma versão de letra encontrada. Crie letras no{" "}
          <Link
            href={`/songs/${songId}/lyrics`}
            className="hover:text-white underline"
          >
            Editor de Letras
          </Link>{" "}
          antes de sincronizar.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href={`/songs/${songId}`}
          className="text-neutral-400 hover:text-white text-sm"
        >
          ← {song.nameRomaji}
        </Link>
        <span className="text-neutral-600">/</span>
        <h1 className="font-bold text-2xl">Sincronização de Letras</h1>
      </div>

      <LyricsSynchronization
        lyrics={lyrics}
        languages={languages}
        youtubeMusicId={song.youtubeMusicId ?? ""}
      />
    </div>
  );
}
