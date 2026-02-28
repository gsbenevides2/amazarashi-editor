import Link from "next/link";
import { getAlbums } from "../actions/albums";
import Image from "next/image";

export default async function AlbumsPage() {
  const albums = await getAlbums();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-bold text-2xl">Álbuns</h1>
        <Link
          href="/albums/new"
          className="bg-white hover:bg-neutral-200 px-4 py-2 rounded font-semibold text-black text-sm"
        >
          + Novo Álbum
        </Link>
      </div>

      {albums.length === 0 ? (
        <p className="text-neutral-400">Nenhum álbum cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {albums.map((album) => (
            <div
              key={album.id}
              className="flex items-center gap-4 bg-neutral-800 p-4 rounded-lg"
            >
              <Image
                src={album.image}
                alt={album.nameRomaji}
                width={1000}
                height={1000}
                className="rounded w-14 h-14 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{album.nameRomaji}</p>
                <p className="text-neutral-400 text-sm truncate">
                  {album.namePortuguese} · {album.releaseDate}
                </p>
              </div>
              <Link
                href={`/albums/${album.id}`}
                className="px-3 py-1 border border-neutral-600 hover:border-neutral-400 rounded text-neutral-300 hover:text-white text-sm"
              >
                Editar
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
