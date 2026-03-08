"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createSong } from "@/app/_actions/songs";
import { uploadImage } from "@/app/_actions/upload";

export default function NewSongForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customId, setCustomId] = useState("");
  const [nameRomaji, setNameRomaji] = useState("");
  const [nameHiragana, setNameHiragana] = useState("");
  const [nameEnglish, setNameEnglish] = useState("");
  const [namePortuguese, setNamePortuguese] = useState("");
  const [duration, setDuration] = useState("");
  const [youtubeVideoClipId, setYoutubeVideoClipId] = useState("");
  const [youtubeMusicId, setYoutubeMusicId] = useState("");
  const [spotifyId, setSpotifyId] = useState("");
  const [videoClipCoverUrl, setVideoClipCoverUrl] = useState("");
  const [description, setDescription] = useState("");
  const [releaseDate, setReleaseDate] = useState(
    new Date().toISOString().split("T")[0],
  );

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

    // Validações
    if (!videoClipCoverUrl) {
      setError("A capa do vídeo clipe é obrigatória.");
      return;
    }

    if (!duration || parseInt(duration, 10) <= 0) {
      setError("A duração deve ser um valor válido maior que zero.");
      return;
    }

    startTransition(async () => {
      try {
        const newSongId = await createSong({
          id: customId || undefined,
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

        // Redirecionar para a página de edição da música criada
        router.push(`/songs/${newSongId}`);
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

      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="ID Customizado (opcional)">
            <input
              type="text"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              className={inputCls}
              placeholder="Deixe em branco para gerar automaticamente"
            />
            <p className="mt-1 text-gray-400 text-xs">
              Se especificado, será usado como ID único da música. Caso
              contrário, um ID será gerado automaticamente.
            </p>
          </Field>
        </div>
        <Field label="Nome Romaji">
          <input
            type="text"
            value={nameRomaji}
            onChange={(e) => setNameRomaji(e.target.value)}
            required
            className={inputCls}
            placeholder="Ex: Kisetsu wa Tsugitsugi Shindeiku"
          />
        </Field>
        <Field label="Nome Hiragana">
          <input
            type="text"
            value={nameHiragana}
            onChange={(e) => setNameHiragana(e.target.value)}
            required
            className={inputCls}
            placeholder="Ex: きせつはつぎつぎしんでいく"
          />
        </Field>
        <Field label="Nome em Inglês">
          <input
            type="text"
            value={nameEnglish}
            onChange={(e) => setNameEnglish(e.target.value)}
            required
            className={inputCls}
            placeholder="Ex: The Seasons Die Out, One After Another"
          />
        </Field>
        <Field label="Nome em Português">
          <input
            type="text"
            value={namePortuguese}
            onChange={(e) => setNamePortuguese(e.target.value)}
            required
            className={inputCls}
            placeholder="Ex: As Estações Morrem, Uma Após a Outra"
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
            placeholder="Ex: 240"
          />
        </Field>
        <Field label="Data de Lançamento">
          <input
            type="date"
            value={releaseDate}
            onChange={(e) => setReleaseDate(e.target.value)}
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
            placeholder="Ex: OLAK5uy_lxgBjgy7zf9pCELGrks_GyDp6qVJr85o0"
          />
        </Field>
        <Field label="YouTube Video Clip ID">
          <input
            type="text"
            value={youtubeVideoClipId}
            onChange={(e) => setYoutubeVideoClipId(e.target.value)}
            className={inputCls}
            placeholder="Ex: dQw4w9WgXcQ"
          />
        </Field>
        <Field label="Spotify ID">
          <input
            type="text"
            value={spotifyId}
            onChange={(e) => setSpotifyId(e.target.value)}
            className={inputCls}
            placeholder="Ex: 4uLU6hMCjMI75M1A2tKUQC"
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Capa do Video Clip *">
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
                  <p className="text-blue-400 text-sm">Enviando imagem...</p>
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
                    width={320}
                    height={180}
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
          placeholder="Descrição opcional da música..."
        />
      </Field>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-neutral-600 hover:bg-neutral-500 px-6 py-2 rounded font-semibold text-white"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-white hover:bg-neutral-200 disabled:opacity-50 px-6 py-2 rounded font-semibold text-black disabled:cursor-not-allowed"
        >
          {isPending ? "Criando..." : "Criar Música"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white placeholder-neutral-400";

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
