import Link from "next/link";
import { getSongs } from "../_actions/songs";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function SongsPage() {
  const songs = await getSongs();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 font-bold text-2xl">Músicas</h1>

      {songs.length === 0 ? (
        <p className="text-neutral-400">Nenhuma música cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {songs.map((song) => (
            <div
              key={song.id}
              className="flex items-start gap-4 bg-neutral-800 p-4 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{song.nameRomaji}</p>
                <p className="text-neutral-400 text-sm">
                  {song.namePortuguese} · {formatDuration(song.duration)} ·{" "}
                  {song.releaseDate}
                </p>
                {song.albums.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {song.albums.map((a) => (
                      <span
                        key={a.id}
                        className="bg-neutral-700 px-2 py-0.5 rounded text-neutral-300 text-xs"
                      >
                        {a.nameRomaji}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Link
                  href={`/songs/${song.id}`}
                  className="px-2 py-1 border border-neutral-600 hover:border-neutral-400 rounded text-neutral-300 hover:text-white text-xs"
                >
                  Editar
                </Link>
                <Link
                  href={`/songs/${song.id}/lyrics`}
                  className="px-2 py-1 border border-neutral-600 hover:border-neutral-400 rounded text-neutral-300 hover:text-white text-xs"
                >
                  Letras
                </Link>
                <Link
                  href={`/songs/${song.id}/sync`}
                  className="px-2 py-1 border border-neutral-600 hover:border-neutral-400 rounded text-neutral-300 hover:text-white text-xs"
                >
                  Sincronizar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
