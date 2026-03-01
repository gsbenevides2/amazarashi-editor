"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { saveLyrics, Lyrics } from "../actions/lyrics";

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
        }
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
  const [selectedLanguage, setSelectedLanguage] = useState(languages[0]?.id ?? "");
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-sync states
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncProgress, setAutoSyncProgress] = useState<string>('');
  const [autoSyncResult, setAutoSyncResult] = useState<any>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      return line.texts.find((t) => t.languageId === selectedLanguage)?.text ?? "";
    },
    [selectedLanguage]
  );

  // Auto-sync handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setAutoSyncResult(null);
    }
  };

  const handleAutoSync = async () => {
    if (!audioFile || !currentLyrics) return;

    setIsAutoSyncing(true);
    setAutoSyncResult(null);
    
    try {
      setAutoSyncProgress('Uploading and processing audio with AI...');
      
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('languageId', selectedLanguage);
      
      const response = await fetch(`/api/songs/${currentLyrics.musicId}/auto-sync`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Auto-sync failed');
      }
      
      setAutoSyncResult(result);
      
      if (result.success && result.alignedLines) {
        setAutoSyncProgress('Synchronization completed! Timestamps have been saved.');
        
        // Update the lyrics array with new timestamps
        const updatedLyricsArray = [...lyricsArray];
        const updatedLyrics = { ...currentLyrics };
        const updatedLines = [...updatedLyrics.lines];
        
        // Apply the aligned timestamps
        result.alignedLines.forEach((alignedLine: any) => {
          const lineIndex = updatedLines.findIndex(line => line.id === alignedLine.lineId);
          if (lineIndex >= 0) {
            updatedLines[lineIndex] = {
              ...updatedLines[lineIndex],
              start: formatTime(alignedLine.startTime),
              end: formatTime(alignedLine.endTime)
            };
          }
        });
        
        updatedLyrics.lines = updatedLines;
        updatedLyricsArray[selectedLyricsIndex] = updatedLyrics;
        setLyricsArray(updatedLyricsArray);
        
        // Show success message with stats
        if (result.stats) {
          setAutoSyncProgress(
            `✅ ${result.stats.alignedLines} de ${result.stats.totalLines} linhas sincronizadas! ` +
            `Confiança média: ${(result.stats.averageConfidence * 100).toFixed(1)}%`
          );
        }
      }
      
    } catch (error) {
      console.error('Auto-sync error:', error);
      setAutoSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsAutoSyncing(false);
    }
  };

  const formatTimeForDisplay = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
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
                setCurrentTime(formatDisplay(playerRef.current.getCurrentTime()));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded text-sm">
          Sincronização salva com sucesso!
        </div>
      )}

      {/* Auto-sync section */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-white mb-4">
          🤖 Sincronização Automática com IA
        </h3>
        <div className="bg-blue-900/20 border border-blue-700 rounded px-3 py-2 mb-4 text-sm text-blue-200">
          <strong>ℹ️ Requisitos:</strong>
          <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
            <li>Áudio em japonês com vocais claros</li>
            <li>Qualidade de áudio boa (sem muito ruído)</li>
            <li>Formatos: MP3, WAV, FLAC, M4A, OGG</li>
            <li>Tamanho máximo: 500MB</li>
          </ul>
        </div>
        <p className="text-neutral-400 text-sm mb-4">
          Faça upload de um arquivo de áudio para sincronizar automaticamente as letras usando AI (GCP Speech-to-Text).
        </p>
        
        <div className="space-y-4">
          <div>
            <input
              type="file"
              accept="audio/*,.flac,.wav,.mp3,.m4a,.aac"
              onChange={handleFileSelect}
              className="block w-full text-sm text-neutral-400
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                file:cursor-pointer cursor-pointer"
              disabled={isAutoSyncing}
            />
            
            {audioFile && (
              <p className="mt-2 text-xs text-neutral-500">
                Arquivo: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAutoSync}
              disabled={!audioFile || isAutoSyncing || !currentLyrics}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:bg-neutral-600 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAutoSyncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processando...
                </>
              ) : (
                '🎯 Sincronizar Automaticamente'
              )}
            </button>
          </div>

          {autoSyncProgress && (
            <div className="bg-blue-900/30 border border-blue-700 text-blue-200 px-3 py-2 rounded text-sm">
              {autoSyncProgress}
            </div>
          )}

          {autoSyncResult && (
            <div className={`px-3 py-2 rounded text-sm ${
              autoSyncResult.success 
                ? 'bg-green-900/30 border border-green-700 text-green-200'
                : 'bg-red-900/30 border border-red-700 text-red-200'
            }`}>
              {autoSyncResult.success ? (
                <>
                  ✅ {autoSyncResult.stats?.alignedLines || 0} de {autoSyncResult.stats?.totalLines || 0} linhas sincronizadas!
                  {autoSyncResult.stats && (
                    <span className="block text-xs opacity-80 mt-1">
                      Confiança média: {(autoSyncResult.stats.averageConfidence * 100).toFixed(1)}%
                    </span>
                  )}
                  <span className="block text-xs opacity-80 mt-1">
                    Os timestamps foram salvos automaticamente no banco de dados.
                  </span>
                </>
              ) : (
                <>
                  <div className="font-semibold">❌ Erro: {autoSyncResult.error}</div>
                  {autoSyncResult.error.includes('No transcription results') && (
                    <div className="mt-2 text-xs space-y-1">
                      <div className="font-semibold">💡 Possíveis causas:</div>
                      <ul className="list-disc list-inside ml-2 space-y-0.5">
                        <li>Áudio é instrumental (sem vocais claros)</li>
                        <li>Vocais muito baixos ou misturados com música</li>
                        <li>Qualidade do áudio ruim</li>
                        <li>Idioma não é japonês</li>
                      </ul>
                      <div className="mt-2 font-semibold">🔧 Sugestões:</div>
                      <ul className="list-disc list-inside ml-2 space-y-0.5">
                        <li>Use um áudio com vocais mais claros</li>
                        <li>Tente remover música de fundo com ferramentas de separação de áudio</li>
                        <li>Verifique se o áudio está em japonês</li>
                      </ul>
                    </div>
                  )}
                </>
              )}
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
            className="bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* YouTube Player */}
        <div className="bg-neutral-800 rounded-lg p-4 flex justify-center items-center min-h-[300px]">
          {youtubeMusicId ? (
            <div ref={playerContainerRef} className="w-full aspect-video" />
          ) : (
            <p className="text-neutral-500 text-sm">
              Esta música não possui YouTube Music ID configurado.
            </p>
          )}
        </div>

        {/* Control panel */}
        <div className="bg-neutral-800 rounded-lg p-4 space-y-4">
          <h2 className="text-lg font-semibold">Controles</h2>
          <p className="text-neutral-400 text-sm">
            Clique em <strong>Registrar</strong> para marcar o fim da linha atual e o início da próxima.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Linha Atual</label>
              <div className="bg-yellow-950 border border-yellow-800 rounded p-3 min-h-12 text-yellow-200 text-sm">
                {currentLine ? getLineText(lines, currentLineIndex) : (
                  <span className="text-neutral-500 italic">—</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Próxima Linha</label>
              <div className="bg-neutral-700 border border-neutral-600 rounded p-3 min-h-12 text-neutral-300 text-sm">
                {nextLine ? getLineText(lines, currentLineIndex + 1) : (
                  <span className="text-neutral-500 italic">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-400">
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
              className="bg-purple-700 hover:bg-purple-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              Registrar
            </button>
            {!isPreviewMode ? (
              <button
                onClick={handlePreview}
                disabled={!youtubeMusicId}
                type="button"
                className="bg-blue-700 hover:bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
              >
                Preview
              </button>
            ) : (
              <button
                onClick={handleStop}
                type="button"
                className="bg-red-700 hover:bg-red-600 text-white rounded px-4 py-2 text-sm"
              >
                Stop
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              type="button"
              className="bg-green-700 hover:bg-green-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50 ml-auto"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>

      {/* Timeline table */}
      <div className="bg-neutral-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Timeline</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left px-3 py-2 text-xs text-neutral-400 uppercase">Start</th>
                <th className="text-left px-3 py-2 text-xs text-neutral-400 uppercase">End</th>
                <th className="text-left px-3 py-2 text-xs text-neutral-400 uppercase">Texto</th>
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
                    {line.texts.find((t) => t.languageId === selectedLanguage)?.text ?? ""}
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
