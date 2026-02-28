"use client";

import { useState, useTransition } from "react";
import { saveLyrics, createLyricsVersion, Lyrics, LyricsLine } from "../actions/lyrics";
import { translateLyrics } from "../actions/translate";

interface Language {
  id: string;
  name: string;
}

interface LyricsEditorProps {
  songId: string;
  lyrics: Lyrics[];
  languages: Language[];
}

export default function LyricsEditor({ songId, lyrics: initialLyrics, languages }: LyricsEditorProps) {
  const [lyricsArray, setLyricsArray] = useState<Lyrics[]>(initialLyrics);
  const [selectedLyricsIndex, setSelectedLyricsIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(languages[0]?.id ?? "");
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const currentLyrics = lyricsArray[selectedLyricsIndex];

  const handleAddVersion = async () => {
    const newId = await createLyricsVersion(songId);
    setLyricsArray((prev) => [
      ...prev,
      { id: newId, musicId: songId, lines: [] },
    ]);
    setSelectedLyricsIndex(lyricsArray.length);
    setSelectedLineIndex(null);
  };

  const handleAddLine = () => {
    if (!currentLyrics) return;
    const newLine: LyricsLine = {
      id: crypto.randomUUID(),
      position: currentLyrics.lines.length,
      start: "00:00:00.00",
      end: "00:00:05.00",
      texts: languages.map((lang) => ({
        id: crypto.randomUUID(),
        languageId: lang.id,
        text: "",
      })),
    };
    setLyricsArray((prev) => {
      const updated = [...prev];
      updated[selectedLyricsIndex] = {
        ...updated[selectedLyricsIndex],
        lines: [...updated[selectedLyricsIndex].lines, newLine],
      };
      return updated;
    });
    setSelectedLineIndex(currentLyrics.lines.length);
  };

  const handleRemoveLine = () => {
    if (selectedLineIndex === null) return;
    setLyricsArray((prev) => {
      const updated = [...prev];
      const newLines = updated[selectedLyricsIndex].lines.filter(
        (_, i) => i !== selectedLineIndex
      );
      updated[selectedLyricsIndex] = {
        ...updated[selectedLyricsIndex],
        lines: newLines.map((l, i) => ({ ...l, position: i })),
      };
      return updated;
    });
    setSelectedLineIndex(null);
  };

  const handleLineFieldChange = (field: "start" | "end", value: string) => {
    if (selectedLineIndex === null) return;
    setLyricsArray((prev) => {
      const updated = [...prev];
      const lines = [...updated[selectedLyricsIndex].lines];
      lines[selectedLineIndex] = { ...lines[selectedLineIndex], [field]: value };
      updated[selectedLyricsIndex] = { ...updated[selectedLyricsIndex], lines };
      return updated;
    });
  };

  const handleLineTextChange = (value: string) => {
    if (selectedLineIndex === null) return;
    setLyricsArray((prev) => {
      const updated = [...prev];
      const lines = [...updated[selectedLyricsIndex].lines];
      const line = lines[selectedLineIndex];
      const textIdx = line.texts.findIndex((t) => t.languageId === selectedLanguage);
      if (textIdx === -1) return prev;
      const newTexts = [...line.texts];
      newTexts[textIdx] = { ...newTexts[textIdx], text: value };
      lines[selectedLineIndex] = { ...line, texts: newTexts };
      updated[selectedLyricsIndex] = { ...updated[selectedLyricsIndex], lines };
      return updated;
    });
  };

  const handleAutoTranslate = async () => {
    if (isTranslating || !currentLyrics) return;
    setIsTranslating(true);
    setError(null);
    try {
      const hiraganaLines = currentLyrics.lines.flatMap((line) =>
        line.texts
          .filter((t) => t.languageId === "hiragana" && t.text.trim().length > 0)
          .map((t) => t.text)
      );

      if (hiraganaLines.length === 0) {
        setError("Nenhuma linha em Hiragana encontrada para traduzir.");
        return;
      }

      const result = await translateLyrics(hiraganaLines);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      setLyricsArray((prev) => {
        const updated = [...prev];
        const lines = updated[selectedLyricsIndex].lines.map((line) => {
          const hiraganaText = line.texts.find((t) => t.languageId === "hiragana")?.text ?? "";
          if (!hiraganaText.trim()) return line;

          const translation = result.lyrics.find((r) => r.original === hiraganaText);
          if (!translation) return line;

          const newTexts = [...line.texts];

          const romanjiIdx = newTexts.findIndex((t) => t.languageId === "romanji");
          if (romanjiIdx === -1) {
            newTexts.push({ id: crypto.randomUUID(), languageId: "romanji", text: translation.romanized });
          } else {
            newTexts[romanjiIdx] = { ...newTexts[romanjiIdx], text: translation.romanized };
          }

          const ptIdx = newTexts.findIndex((t) => t.languageId === "portuguese");
          if (ptIdx === -1) {
            newTexts.push({ id: crypto.randomUUID(), languageId: "portuguese", text: translation.translated });
          } else {
            newTexts[ptIdx] = { ...newTexts[ptIdx], text: translation.translated };
          }

          return { ...line, texts: newTexts };
        });
        updated[selectedLyricsIndex] = { ...updated[selectedLyricsIndex], lines };
        return updated;
      });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = () => {
    setError(null);
    setSaveSuccess(false);
    startSaveTransition(async () => {
      try {
        await saveLyrics(lyricsArray);
        setSaveSuccess(true);
      } catch (err) {
        setError(String(err));
      }
    });
  };

  if (lyricsArray.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-neutral-400 mb-4">Nenhuma versão de letra cadastrada.</p>
        <button
          onClick={handleAddVersion}
          className="bg-white text-black font-semibold px-6 py-2 rounded hover:bg-neutral-200"
        >
          Criar Versão de Letra
        </button>
      </div>
    );
  }

  const selectedLine = selectedLineIndex !== null ? currentLyrics?.lines[selectedLineIndex] : null;
  const selectedText = selectedLine?.texts.find((t) => t.languageId === selectedLanguage);

  return (
    <div className="space-y-4 max-w-3xl">
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded text-sm">
          Letras salvas com sucesso!
        </div>
      )}

      {/* Version selector */}
      <div className="flex items-center gap-3">
        {lyricsArray.length > 1 && (
          <div className="flex-1">
            <label className="block text-xs text-neutral-400 mb-1">Versão</label>
            <select
              value={selectedLyricsIndex}
              onChange={(e) => {
                setSelectedLyricsIndex(Number(e.target.value));
                setSelectedLineIndex(null);
              }}
              className="bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
            >
              {lyricsArray.map((l, i) => (
                <option key={l.id} value={i}>
                  Versão {i + 1}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={handleAddVersion}
          className="mt-auto text-sm text-neutral-400 hover:text-white border border-neutral-600 rounded px-3 py-2 hover:border-neutral-400"
        >
          + Nova Versão
        </button>
      </div>

      {/* Language selector */}
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Idioma</label>
        <div className="flex gap-2 flex-wrap">
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

      {/* Auto translate button */}
      <button
        onClick={handleAutoTranslate}
        disabled={isTranslating}
        type="button"
        className="w-full bg-neutral-700 hover:bg-neutral-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {isTranslating ? "Traduzindo..." : "Auto Romanizar e Traduzir"}
      </button>

      {/* Lines list */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-neutral-400">
            Linhas ({currentLyrics?.lines.length ?? 0})
          </label>
        </div>
        <div className="max-h-64 overflow-y-auto border border-neutral-700 rounded bg-neutral-800">
          {currentLyrics?.lines.length === 0 ? (
            <p className="p-4 text-neutral-500 text-sm">Nenhuma linha. Clique em &quot;Adicionar Linha&quot;.</p>
          ) : (
            currentLyrics?.lines.map((line, index) => {
              const text = line.texts.find((t) => t.languageId === selectedLanguage);
              return (
                <div
                  key={line.id}
                  onClick={() => setSelectedLineIndex(index)}
                  className={`p-3 border-b border-neutral-700 cursor-pointer ${
                    selectedLineIndex === index ? "bg-neutral-700" : "hover:bg-neutral-750"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-neutral-500">#{index}</span>
                    <span className="text-xs text-neutral-500">
                      {line.start} — {line.end}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5 text-white">
                    {text?.text || <span className="text-neutral-600 italic">vazio</span>}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected line editor */}
      {selectedLine && (
        <div className="bg-neutral-800 border border-neutral-700 rounded p-4 space-y-3">
          <label className="block text-xs text-neutral-400">Editar Linha</label>
          <textarea
            value={selectedText?.text ?? ""}
            onChange={(e) => handleLineTextChange(e.target.value)}
            rows={3}
            placeholder="Texto da linha..."
            className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
          />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Posição</label>
              <div className="bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-sm text-neutral-400 text-center">
                {selectedLineIndex}
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Start</label>
              <input
                type="text"
                value={selectedLine.start}
                onChange={(e) => handleLineFieldChange("start", e.target.value)}
                placeholder="00:00:00.00"
                className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">End</label>
              <input
                type="text"
                value={selectedLine.end}
                onChange={(e) => handleLineFieldChange("end", e.target.value)}
                placeholder="00:00:00.00"
                className="w-full bg-neutral-700 border border-neutral-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleRemoveLine}
          disabled={selectedLineIndex === null}
          type="button"
          className="border border-neutral-600 text-neutral-300 hover:text-white rounded px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Remover Linha
        </button>
        <button
          onClick={handleAddLine}
          type="button"
          className="bg-neutral-700 hover:bg-neutral-600 text-white rounded px-4 py-2 text-sm"
        >
          Adicionar Linha
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          type="button"
          className="ml-auto bg-white text-black font-semibold rounded px-6 py-2 text-sm hover:bg-neutral-200 disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
