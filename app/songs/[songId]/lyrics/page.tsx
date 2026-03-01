import Link from "next/link";
import { notFound } from "next/navigation";
import { getSong } from "../../../_actions/songs";
import { getLyrics, getLanguages } from "../../../_actions/lyrics";
import LyricsEditor from "../../../_components/LyricsEditor";

type Props = { params: Promise<{ songId: string }> };

export const dynamic = "force-dynamic";

export default async function LyricsPage({ params }: Props) {
  const { songId } = await params;
  const [song, lyrics, languages] = await Promise.all([
    getSong(songId),
    getLyrics(songId),
    getLanguages(),
  ]);

  if (!song) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href={`/songs/${songId}`}
          className="text-neutral-400 hover:text-white text-sm"
        >
          ← {song.nameRomaji}
        </Link>
        <span className="text-neutral-600">/</span>
        <h1 className="font-bold text-2xl">Editor de Letras</h1>
      </div>

      <LyricsEditor songId={songId} lyrics={lyrics} languages={languages} />
    </div>
  );
}
