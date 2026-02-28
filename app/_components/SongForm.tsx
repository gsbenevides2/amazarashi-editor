"use client";

import { useState, useTransition } from "react";
import { updateSong } from "../actions/songs";
import { uploadImage } from "../actions/upload";
import Image from "next/image";

type SongFormProps = {
  songId: string;
  initialData: {
    nameRomaji: string;
    nameHiragana: string;
    nameEnglish: string;
    namePortuguese: string;
    duration: number;
    youtubeVideoClipId: string | null;
    youtubeMusicId: string | null;
    spotifyId: string | null;
    videoClipCoverUrl: string;
    description: string | null;
    releaseDate: string;
  };
  albums: { id: string; nameRomaji: string }[];
};

export default function SongForm({
  songId,
  initialData,
  albums,
}: SongFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [nameRomaji, setNameRomaji] = useState(initialData.nameRomaji);
  const [nameHiragana, setNameHiragana] = useState(initialData.nameHiragana);
  const [nameEnglish, setNameEnglish] = useState(initialData.nameEnglish);
  const [namePortuguese, setNamePortuguese] = useState(
    initialData.namePortuguese,
  );
  const [duration, setDuration] = useState(String(initialData.duration));
  const [youtubeVideoClipId, setYoutubeVideoClipId] = useState(
    initialData.youtubeVideoClipId ?? "",
  );
  const [youtubeMusicId, setYoutubeMusicId] = useState(
    initialData.youtubeMusicId ?? "",
  );
  const [spotifyId, setSpotifyId] = useState(initialData.spotifyId ?? "");
  const [videoClipCoverUrl, setVideoClipCoverUrl] = useState(
    initialData.videoClipCoverUrl,
  );
  const [description, setDescription] = useState(initialData.description ?? "");
  const [releaseDate, setReleaseDate] = useState(initialData.releaseDate);

  // Estados para upload da capa
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadImage(formData);

      if ("error" in result) {
        setUploadError(result.error);
      } else {
        setVideoClipCoverUrl(result.url);
        setUploadError(null);
      }
    } catch (err) {
      setUploadError(String(err));
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validação da capa
    if (!videoClipCoverUrl) {
      setError("A capa do vídeo clipe é obrigatória.");
      return;
    }

    startTransition(async () => {
      try {
        await updateSong(songId, {
          nameRomaji,
          nameHiragana,
          nameEnglish,
          namePortuguese,
          duration: parseInt(duration, 10),
          youtubeVideoClipId: youtubeVideoClipId || null,
          youtubeMusicId: youtubeMusicId || null,
          spotifyId: spotifyId || null,
          videoClipCoverUrl,
          description: description || null,
          releaseDate,
        });
        setSuccess(true);
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
          Música salva com sucesso!
        </div>
      )}

      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
        <Field label="Nome Romaji">
          <input
            type="text"
            value={nameRomaji}
            onChange={(e) => setNameRomaji(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Nome Hiragana">
          <input
            type="text"
            value={nameHiragana}
            onChange={(e) => setNameHiragana(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Nome em Inglês">
          <input
            type="text"
            value={nameEnglish}
            onChange={(e) => setNameEnglish(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Nome em Português">
          <input
            type="text"
            value={namePortuguese}
            onChange={(e) => setNamePortuguese(e.target.value)}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Duração (segundos)">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required
            min={0}
            className={inputCls}
          />
        </Field>
        <Field label="Data de Lançamento">
          <input
            type="text"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
            placeholder="YYYY-MM-DD"
            required
            className={inputCls}
          />
        </Field>
        <Field label="YouTube Music ID">
          <input
            type="text"
            value={youtubeMusicId}
            onChange={(e) => setYoutubeMusicId(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="YouTube Video Clip ID">
          <input
            type="text"
            value={youtubeVideoClipId}
            onChange={(e) => setYoutubeVideoClipId(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Spotify ID">
          <input
            type="text"
            value={spotifyId}
            onChange={(e) => setSpotifyId(e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Capa do Video Clip">
            <div className="space-y-3">
              {/* Campo de Upload */}
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  disabled={isUploadingCover}
                  required
                  className="text-neutral-300 text-sm"
                />

                {isUploadingCover && (
                  <p className="text-blue-400 text-sm">Enviando...</p>
                )}

                {uploadError && (
                  <p className="text-red-400 text-sm">{uploadError}</p>
                )}
              </div>

              {/* Preview da imagem */}
              {videoClipCoverUrl && (
                <div className="mt-3">
                  <p className="mb-2 text-neutral-300 text-sm">Preview:</p>
                  <Image
                    width={1280}
                    height={720}
                    src={videoClipCoverUrl}
                    alt="Preview da capa"
                    className="border border-neutral-600 rounded max-w-xs object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </Field>
        </div>
      </div>

      <Field label="Descrição">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white"
        />
      </Field>

      {albums.length > 0 && (
        <div>
          <label className="block mb-2 font-medium text-neutral-300 text-sm">
            Álbuns (somente leitura — gerenciar nos álbuns)
          </label>
          <div className="flex flex-wrap gap-2">
            {albums.map((a) => (
              <span
                key={a.id}
                className="bg-neutral-700 px-3 py-1 rounded text-neutral-300 text-xs"
              >
                {a.nameRomaji}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="bg-white hover:bg-neutral-200 disabled:opacity-50 px-6 py-2 rounded font-semibold text-black disabled:cursor-not-allowed"
      >
        {isPending ? "Salvando..." : "Salvar Música"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white";

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
