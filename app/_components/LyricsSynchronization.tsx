/* eslint-disable react-hooks/refs */
"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { saveLyrics, Lyrics } from "../actions/lyrics";
import { synchronizeAudioWithExistingLyrics } from "../actions/speech-to-text";

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string | HTMLElement,
        config: {
          videoId: string;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
}

interface Language {
  id: string;
  name: string;
}

interface LyricsSynchronizationProps {
  lyrics: Lyrics[];
  languages: Language[];
  youtubeMusicId: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

function parseTime(ts: string): number {
  const parts = ts.split(":");
  if (parts.length !== 3) return 0;
  const [h, min, rest] = parts;
  const [s, ms] = (rest ?? "0").split(".");
  return (
    parseInt(h ?? "0") * 3600 +
    parseInt(min ?? "0") * 60 +
    parseInt(s ?? "0") +
    parseInt(ms ?? "0") / 100
  );
}

function formatDisplay(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function LyricsSynchronization({
  lyrics: initialLyrics,
  languages,
  youtubeMusicId,
}: LyricsSynchronizationProps) {
  const [lyricsArray, setLyricsArray] = useState<Lyrics[]>(initialLyrics);
  const [selectedLyricsIndex, setSelectedLyricsIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(
    languages[0]?.id ?? "",
  );
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-sync states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [autoSyncErrorMessage, setAutoSyncErrorMessage] = useState<string>("");
  const [autoSyncState, setAutoSyncState] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");

  const playerRef = useRef<YTPlayer | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const currentLyricsIndexRef = useRef(0);

  // Keep ref in sync with state for use inside intervals
  const lyricsArrayRef = useRef(lyricsArray);
  lyricsArrayRef.current = lyricsArray;
  const currentLineIndexRef = useRef(currentLineIndex);
  currentLineIndexRef.current = currentLineIndex;

  const currentLyrics = lyricsArray[selectedLyricsIndex];

  const getLineText = useCallback(
    (lines: Lyrics["lines"], index: number) => {
      const line = lines[index];
      if (!line) return "";
      return (
        line.texts.find((t) => t.languageId === selectedLanguage)?.text ?? ""
      );
    },
    [selectedLanguage],
  );

  // Auto-sync handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleAutoSync = () => {
    if (!audioFile || !currentLyrics) return;

    setAutoSyncState("processing");

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("songId", currentLyrics.musicId);

    synchronizeAudioWithExistingLyrics(formData)
      .then((result) => {
        if (result.success) {
          setAutoSyncState("success");
          // Optionally, you could also update the local state with the new timestamps here
        } else {
          setAutoSyncState("error");
          setAutoSyncErrorMessage(result.error || "Unknown error");
        }
      })
      .catch((error) => {
        setAutoSyncState("error");
        setAutoSyncErrorMessage(String(error));
      });
  };

  // Initialize YouTube player
  useEffect(() => {
    if (!youtubeMusicId) return;

    const initPlayer = () => {
      if (!playerContainerRef.current) return;
      playerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: youtubeMusicId,
        events: {
          onReady: () => {
            // Start time display updates
            setInterval(() => {
              if (playerRef.current) {
                setCurrentTime(
                  formatDisplay(playerRef.current.getCurrentTime()),
                );
              }
            }, 500);
          },
        },
      });
    };

    if (typeof window.YT !== "undefined" && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    return () => {
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
      }
    };
  }, [youtubeMusicId]);

  // Update currentLyricsIndexRef when selectedLyricsIndex changes
  useEffect(() => {
    currentLyricsIndexRef.current = selectedLyricsIndex;
  }, [selectedLyricsIndex]);

  const handleRegister = () => {
    const player = playerRef.current;
    if (!player) return;
    const time = player.getCurrentTime();
    const formatted = formatTime(time);

    setLyricsArray((prev) => {
      const updated = [...prev];
      const idx = currentLyricsIndexRef.current;
      const lines = [...updated[idx].lines];
      const lineIdx = currentLineIndexRef.current;

      if (lines[lineIdx]) {
        lines[lineIdx] = { ...lines[lineIdx], end: formatted };
      }
      if (lines[lineIdx + 1]) {
        lines[lineIdx + 1] = { ...lines[lineIdx + 1], start: formatted };
      }
      updated[idx] = { ...updated[idx], lines };
      return updated;
    });

    setCurrentLineIndex((prev) => prev + 1);
  };

  const handlePreview = () => {
    const player = playerRef.current;
    if (!player) return;

    setCurrentLineIndex(0);
    player.seekTo(0, true);
    player.playVideo();
    setIsPreviewMode(true);

    previewIntervalRef.current = setInterval(() => {
      if (!playerRef.current) return;
      const time = playerRef.current.getCurrentTime();
      const idx = currentLyricsIndexRef.current;
      const lines = lyricsArrayRef.current[idx]?.lines ?? [];
      const nextLine = lines[currentLineIndexRef.current + 1];

      if (nextLine && time >= parseTime(nextLine.start)) {
        setCurrentLineIndex((prev) => prev + 1);
      }
    }, 100);
  };

  const handleStop = () => {
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    if (playerRef.current) {
      playerRef.current.pauseVideo();
    }
    setCurrentLineIndex(0);
    setIsPreviewMode(false);
  };

  const handleSave = () => {
    setSaveError(null);
    setSaveSuccess(false);
    startSaveTransition(async () => {
      try {
        await saveLyrics(lyricsArray);
        setSaveSuccess(true);
      } catch (err) {
        setSaveError(String(err));
      }
    });
  };

  const lines = currentLyrics?.lines ?? [];
  const currentLine = lines[currentLineIndex];
  const nextLine = lines[currentLineIndex + 1];

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="bg-red-900 px-4 py-3 border border-red-700 rounded text-red-200 text-sm">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-900 px-4 py-3 border border-green-700 rounded text-green-200 text-sm">
          Sincronização salva com sucesso!
        </div>
      )}

      {/* Auto-sync section */}
      <div className="bg-neutral-800 p-5 border border-neutral-700 rounded-lg">
        <h3 className="mb-4 font-semibold text-white text-lg">
          🤖 Sincronização Automática com IA
        </h3>
        <div className="bg-blue-900/20 mb-4 px-3 py-2 border border-blue-700 rounded text-blue-200 text-sm">
          <strong>ℹ️ Requisitos:</strong>
          <ul className="space-y-1 mt-1 text-xs list-disc list-inside">
            <li>Áudio em japonês com vocais claros</li>
            <li>Qualidade de áudio boa (sem muito ruído)</li>
            <li>Formatos: MP3, WAV, FLAC, M4A, OGG</li>
            <li>Tamanho máximo: 500MB</li>
          </ul>
        </div>
        <p className="mb-4 text-neutral-400 text-sm">
          Faça upload de um arquivo de áudio para sincronizar automaticamente as
          letras usando AI (GCP Speech-to-Text).
        </p>

        <div className="space-y-4">
          <div>
            <input
              type="file"
              accept="audio/*,.flac,.wav,.mp3,.m4a,.aac"
              onChange={handleFileSelect}
              className="block hover:file:bg-blue-700 file:bg-blue-600 file:mr-4 file:px-4 file:py-2 file:border-0 file:rounded w-full file:font-semibold text-neutral-400 file:text-white text-sm file:text-sm cursor-pointer file:cursor-pointer"
              disabled={autoSyncState !== "idle"}
            />

            {audioFile && (
              <p className="mt-2 text-neutral-500 text-xs">
                Arquivo: {audioFile.name} (
                {(audioFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAutoSync}
              disabled={
                !audioFile || autoSyncState !== "idle" || !currentLyrics
              }
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600 px-4 py-2 rounded text-white text-sm disabled:cursor-not-allowed"
            >
              {autoSyncState === "processing" ? (
                <>
                  <div className="border-white border-b-2 rounded-full w-4 h-4 animate-spin"></div>
                  Processando...
                </>
              ) : (
                "🎯 Sincronizar Automaticamente"
              )}
            </button>
          </div>

          {autoSyncState === "processing" && (
            <div className="bg-blue-900/30 px-3 py-2 border border-blue-700 rounded text-blue-200 text-sm">
              ⏳ Processando o áudio e gerando timestamps com AI...
            </div>
          )}
          {autoSyncState === "error" && (
            <div className="bg-red-900/30 px-3 py-2 border border-red-700 rounded text-red-200 text-sm">
              ❌ Erro: {autoSyncErrorMessage}
            </div>
          )}
          {autoSyncState === "success" && (
            <div className="bg-green-900/30 px-3 py-2 border border-green-700 rounded text-green-200 text-sm">
              ✅ Sincronização automática concluída! Revise os timestamps e
              salve.{" "}
              <button
                onClick={() => window.location.reload()}
                className="underline"
              >
                Clique aqui para recarregar a página e ver as mudanças.
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {lyricsArray.length > 1 && (
          <select
            value={selectedLyricsIndex}
            onChange={(e) => {
              setSelectedLyricsIndex(Number(e.target.value));
              setCurrentLineIndex(0);
              handleStop();
            }}
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded text-white text-sm"
          >
            {lyricsArray.map((l, i) => (
              <option key={l.id} value={i}>
                Versão {i + 1}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          {languages.map((lang) => (
            <button
              key={lang.id}
              onClick={() => setSelectedLanguage(lang.id)}
              type="button"
              className={
                selectedLanguage === lang.id
                  ? "bg-white text-black px-3 py-1 rounded text-sm font-medium"
                  : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600 px-3 py-1 rounded text-sm"
              }
            >
              {lang.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="gap-6 grid grid-cols-1 lg:grid-cols-2">
        {/* YouTube Player */}
        <div className="flex justify-center items-center bg-neutral-800 p-4 rounded-lg min-h-75">
          {youtubeMusicId ? (
            <div ref={playerContainerRef} className="w-full aspect-video" />
          ) : (
            <p className="text-neutral-500 text-sm">
              Esta música não possui YouTube Music ID configurado.
            </p>
          )}
        </div>

        {/* Control panel */}
        <div className="space-y-4 bg-neutral-800 p-4 rounded-lg">
          <h2 className="font-semibold text-lg">Controles</h2>
          <p className="text-neutral-400 text-sm">
            Clique em <strong>Registrar</strong> para marcar o fim da linha
            atual e o início da próxima.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block mb-1 text-neutral-400 text-xs">
                Linha Atual
              </label>
              <div className="bg-yellow-950 p-3 border border-yellow-800 rounded min-h-12 text-yellow-200 text-sm">
                {currentLine ? (
                  getLineText(lines, currentLineIndex)
                ) : (
                  <span className="text-neutral-500 italic">—</span>
                )}
              </div>
            </div>
            <div>
              <label className="block mb-1 text-neutral-400 text-xs">
                Próxima Linha
              </label>
              <div className="bg-neutral-700 p-3 border border-neutral-600 rounded min-h-12 text-neutral-300 text-sm">
                {nextLine ? (
                  getLineText(lines, currentLineIndex + 1)
                ) : (
                  <span className="text-neutral-500 italic">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400 text-sm">
              Tempo: <span className="font-mono text-white">{currentTime}</span>
              <span className="ml-3 text-neutral-500">
                Linha {currentLineIndex + 1} / {lines.length}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRegister}
              disabled={!youtubeMusicId}
              type="button"
              className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 px-4 py-2 rounded text-white text-sm"
            >
              Registrar
            </button>
            {!isPreviewMode ? (
              <button
                onClick={handlePreview}
                disabled={!youtubeMusicId}
                type="button"
                className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-4 py-2 rounded text-white text-sm"
              >
                Preview
              </button>
            ) : (
              <button
                onClick={handleStop}
                type="button"
                className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded text-white text-sm"
              >
                Stop
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              type="button"
              className="bg-green-700 hover:bg-green-600 disabled:opacity-50 ml-auto px-4 py-2 rounded text-white text-sm"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline table */}
      <div className="bg-neutral-800 p-4 rounded-lg">
        <h2 className="mb-3 font-semibold text-lg">Timeline</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-neutral-700 border-b">
                <th className="px-3 py-2 text-neutral-400 text-xs text-left uppercase">
                  Start
                </th>
                <th className="px-3 py-2 text-neutral-400 text-xs text-left uppercase">
                  End
                </th>
                <th className="px-3 py-2 text-neutral-400 text-xs text-left uppercase">
                  Texto
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr
                  key={line.id}
                  className={`border-b border-neutral-700 ${
                    i === currentLineIndex ? "bg-yellow-950" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-neutral-400 whitespace-nowrap">
                    {line.start}
                  </td>
                  <td className="px-3 py-2 font-mono text-neutral-400 whitespace-nowrap">
                    {line.end}
                  </td>
                  <td className="px-3 py-2 text-white">
                    {line.texts.find((t) => t.languageId === selectedLanguage)
                      ?.text ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
