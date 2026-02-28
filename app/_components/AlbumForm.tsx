"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAlbum, updateAlbum, setAlbumSongs } from "../actions/albums";
import { uploadImage } from "../actions/upload";
import Image from "next/image";

type Song = { id: string; nameRomaji: string; nameHiragana: string };

interface AlbumFormProps {
  albumId?: string;
  initialData?: {
    nameRomaji: string;
    nameHiragana: string;
    nameEnglish: string;
    namePortuguese: string;
    image: string;
    releaseDate: string;
  };
  initialSongIds?: string[];
  allSongs: Song[];
}

export default function AlbumForm({
  albumId,
  initialData,
  initialSongIds = [],
  allSongs,
}: AlbumFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [nameRomaji, setNameRomaji] = useState(initialData?.nameRomaji ?? "");
  const [nameHiragana, setNameHiragana] = useState(
    initialData?.nameHiragana ?? "",
  );
  const [nameEnglish, setNameEnglish] = useState(
    initialData?.nameEnglish ?? "",
  );
  const [namePortuguese, setNamePortuguese] = useState(
    initialData?.namePortuguese ?? "",
  );
  const [releaseDate, setReleaseDate] = useState(
    initialData?.releaseDate ?? "",
  );
  const [imageUrl, setImageUrl] = useState(initialData?.image ?? "");
  const [selectedSongIds, setSelectedSongIds] =
    useState<string[]>(initialSongIds);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadImage(fd);
      if ("error" in result) {
        setError(`Upload failed: ${result.error}`);
      } else {
        setImageUrl(result.url);
      }
    } finally {
      setUploading(false);
    }
  };

  const toggleSong = (songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId],
    );
  };

  const moveSongUp = (index: number) => {
    if (index > 0) {
      setSelectedSongIds((prev) => {
        const newIds = [...prev];
        [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
        return newIds;
      });
    }
  };

  const moveSongDown = (index: number) => {
    setSelectedSongIds((prev) => {
      if (index < prev.length - 1) {
        const newIds = [...prev];
        [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
        return newIds;
      }
      return prev;
    });
  };

  const getSelectedSongs = () => {
    return selectedSongIds
      .map((id) => allSongs.find((song) => song.id === id))
      .filter(Boolean) as Song[];
  };

  const getUnselectedSongs = () => {
    return allSongs.filter((song) => !selectedSongIds.includes(song.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!imageUrl) {
      setError("A imagem de capa é obrigatória.");
      return;
    }

    const data = {
      nameRomaji,
      nameHiragana,
      nameEnglish,
      namePortuguese,
      image: imageUrl,
      releaseDate,
    };

    startTransition(async () => {
      try {
        if (albumId) {
          await updateAlbum(albumId, data);
          await setAlbumSongs(albumId, selectedSongIds);
          setSuccess(true);
        } else {
          const newId = await createAlbum(data);
          await setAlbumSongs(newId, selectedSongIds);
          router.push(`/albums/${newId}`);
        }
      } catch (err) {
        setError(String(err));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {error && (
        <div className="bg-red-900 px-4 py-3 border border-red-700 rounded text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900 px-4 py-3 border border-green-700 rounded text-green-200">
          Álbum salvo com sucesso!
        </div>
      )}

      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
        <Field label="Nome Romaji">
          <input
            type="text"
            value={nameRomaji}
            onChange={(e) => setNameRomaji(e.target.value)}
            required
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white"
          />
        </Field>
        <Field label="Nome Hiragana">
          <input
            type="text"
            value={nameHiragana}
            onChange={(e) => setNameHiragana(e.target.value)}
            required
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white"
          />
        </Field>
        <Field label="Nome em Inglês">
          <input
            type="text"
            value={nameEnglish}
            onChange={(e) => setNameEnglish(e.target.value)}
            required
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white"
          />
        </Field>
        <Field label="Nome em Português">
          <input
            type="text"
            value={namePortuguese}
            onChange={(e) => setNamePortuguese(e.target.value)}
            required
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white"
          />
        </Field>
        <Field label="Data de Lançamento">
          <input
            type="text"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            required
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white"
          />
        </Field>
      </div>

      <Field label="Imagem de Capa">
        <div className="flex items-start gap-4">
          {imageUrl && (
            <Image
              src={imageUrl}
              width={1000}
              height={1000}
              alt="Capa do álbum"
              className="border border-neutral-600 rounded w-24 h-24 object-cover"
            />
          )}
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
              className="text-neutral-300 text-sm"
            />
            {uploading && (
              <span className="text-neutral-400 text-xs">Enviando...</span>
            )}
            {imageUrl && (
              <span className="text-neutral-500 text-xs break-all">
                {imageUrl}
              </span>
            )}
          </div>
        </div>
      </Field>

      {/* Músicas selecionadas e ordenação */}
      {selectedSongIds.length > 0 && (
        <div>
          <label className="block mb-2 font-medium text-neutral-300 text-sm">
            Ordem das Músicas no Álbum ({selectedSongIds.length} músicas)
          </label>
          <div className="bg-neutral-800 border border-neutral-600 rounded max-h-64 overflow-y-auto">
            {getSelectedSongs().map((song, index) => (
              <div
                key={song.id}
                className="flex items-center gap-3 px-4 py-2 border-neutral-700 border-b last:border-b-0"
              >
                <span className="w-6 font-mono text-neutral-400 text-xs">
                  {index + 1}.
                </span>
                <span className="flex-1 text-sm">
                  {song.nameRomaji}
                  <span className="ml-2 text-neutral-400 text-xs">
                    {song.nameHiragana}
                  </span>
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveSongUp(index)}
                    disabled={index === 0}
                    className="disabled:opacity-50 p-1 text-neutral-400 hover:text-white disabled:cursor-not-allowed"
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSongDown(index)}
                    disabled={index === selectedSongIds.length - 1}
                    className="disabled:opacity-50 p-1 text-neutral-400 hover:text-white disabled:cursor-not-allowed"
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSong(song.id)}
                    className="ml-2 p-1 text-red-400 hover:text-red-300"
                    title="Remover do álbum"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Músicas disponíveis para adicionar */}
      <div>
        <label className="block mb-2 font-medium text-neutral-300 text-sm">
          Adicionar Músicas ao Álbum
        </label>
        <div className="bg-neutral-800 border border-neutral-600 rounded max-h-64 overflow-y-auto">
          {allSongs.length === 0 ? (
            <p className="p-4 text-neutral-500 text-sm">
              Nenhuma música cadastrada.
            </p>
          ) : getUnselectedSongs().length === 0 ? (
            <p className="p-4 text-neutral-500 text-sm">
              Todas as músicas já foram adicionadas ao álbum.
            </p>
          ) : (
            getUnselectedSongs().map((song) => (
              <label
                key={song.id}
                className="flex items-center gap-3 hover:bg-neutral-700 px-4 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleSong(song.id)}
                  className="accent-white"
                />
                <span className="text-sm">
                  {song.nameRomaji}
                  <span className="ml-2 text-neutral-400 text-xs">
                    {song.nameHiragana}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || uploading}
        className="bg-white hover:bg-neutral-200 disabled:opacity-50 px-6 py-2 rounded font-semibold text-black disabled:cursor-not-allowed"
      >
        {isPending ? "Salvando..." : albumId ? "Salvar Álbum" : "Criar Álbum"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block mb-1 font-medium text-neutral-300 text-sm">
        {label}
      </label>
      {children}
    </div>
  );
}
