"use client";

import { useState, useTransition } from "react";
import {
  saveLyrics,
  createLyricsVersion,
  deleteLyricsVersion,
  importLyricsFromText,
  Lyrics,
  LyricsLine,
} from "../_actions/lyrics";
import { translateLyrics } from "../_actions/translate";
import LyricsImportModal from "./LyricsImportModal";

interface Language {
  id: string;
  name: string;
}

interface LyricsEditorProps {
  songId: string;
  lyrics: Lyrics[];
  languages: Language[];
}

export default function LyricsEditor({
  songId,
  lyrics: initialLyrics,
  languages,
}: LyricsEditorProps) {
  const [lyricsArray, setLyricsArray] = useState<Lyrics[]>(initialLyrics);
  const [selectedLyricsIndex, setSelectedLyricsIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState(
    languages[0]?.id ?? "",
  );
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(
    null,
  );
  const [isSaving, startSaveTransition] = useTransition();
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, startImportTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

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

  const handleRemoveVersion = () => {
    if (lyricsArray.length <= 1) {
      setError("Não é possível remover a última versão de letras.");
      return;
    }

    const currentLyricsId = currentLyrics?.id;
    if (!currentLyricsId) return;

    if (
      !confirm(
        "Tem certeza que deseja remover esta versão? Esta ação não pode ser desfeita.",
      )
    ) {
      return;
    }

    setError(null);
    setSaveSuccess(false);
    startDeleteTransition(async () => {
      try {
        await deleteLyricsVersion(currentLyricsId);
        const newLyricsArray = lyricsArray.filter(
          (_, i) => i !== selectedLyricsIndex,
        );
        setLyricsArray(newLyricsArray);

        // Adjust selected index if necessary
        const newIndex =
          selectedLyricsIndex >= newLyricsArray.length
            ? Math.max(0, newLyricsArray.length - 1)
            : selectedLyricsIndex;
        setSelectedLyricsIndex(newIndex);
        setSelectedLineIndex(null);
        setSaveSuccess(true);
      } catch (err) {
        setError(String(err));
      }
    });
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
        (_, i) => i !== selectedLineIndex,
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
      lines[selectedLineIndex] = {
        ...lines[selectedLineIndex],
        [field]: value,
      };
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
      const textIdx = line.texts.findIndex(
        (t) => t.languageId === selectedLanguage,
      );
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
          .filter(
            (t) => t.languageId === "hiragana" && t.text.trim().length > 0,
          )
          .map((t) => t.text),
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
          const hiraganaText =
            line.texts.find((t) => t.languageId === "hiragana")?.text ?? "";
          if (!hiraganaText.trim()) return line;

          const translation = result.lyrics.find(
            (r) => r.original === hiraganaText,
          );
          if (!translation) return line;

          const newTexts = [...line.texts];

          const romanjiIdx = newTexts.findIndex(
            (t) => t.languageId === "romanji",
          );
          if (romanjiIdx === -1) {
            newTexts.push({
              id: crypto.randomUUID(),
              languageId: "romanji",
              text: translation.romanized,
            });
          } else {
            newTexts[romanjiIdx] = {
              ...newTexts[romanjiIdx],
              text: translation.romanized,
            };
          }

          const ptIdx = newTexts.findIndex(
            (t) => t.languageId === "portuguese",
          );
          if (ptIdx === -1) {
            newTexts.push({
              id: crypto.randomUUID(),
              languageId: "portuguese",
              text: translation.translated,
            });
          } else {
            newTexts[ptIdx] = {
              ...newTexts[ptIdx],
              text: translation.translated,
            };
          }

          return { ...line, texts: newTexts };
        });
        updated[selectedLyricsIndex] = {
          ...updated[selectedLyricsIndex],
          lines,
        };
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

  const handleImportLyrics = (text: string) => {
    setError(null);
    setSaveSuccess(false);
    startImportTransition(async () => {
      try {
        const newLyrics = await importLyricsFromText(songId, text);
        setLyricsArray([...lyricsArray, newLyrics]);
        setSelectedLyricsIndex(lyricsArray.length);
        setSelectedLineIndex(null);
        setShowImportModal(false);
        setSaveSuccess(true);
      } catch (err) {
        setError(String(err));
      }
    });
  };

  if (lyricsArray.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-neutral-400">
          Nenhuma versão de letra cadastrada.
        </p>
        <button
          onClick={handleAddVersion}
          className="bg-white hover:bg-neutral-200 px-6 py-2 rounded font-semibold text-black"
        >
          Criar Versão de Letra
        </button>
      </div>
    );
  }

  const selectedLine =
    selectedLineIndex !== null ? currentLyrics?.lines[selectedLineIndex] : null;
  const selectedText = selectedLine?.texts.find(
    (t) => t.languageId === selectedLanguage,
  );

  return (
    <div className="space-y-4 max-w-3xl">
      {error && (
        <div className="bg-red-900 px-4 py-3 border border-red-700 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
      {saveSuccess && (
        <div className="bg-green-900 px-4 py-3 border border-green-700 rounded text-green-200 text-sm">
          Letras salvas com sucesso!
        </div>
      )}

      {/* Version selector */}
      <div className="flex items-center gap-3">
        {lyricsArray.length > 1 && (
          <div className="flex-1">
            <label className="block mb-1 text-neutral-400 text-xs">
              Versão
            </label>
            <select
              value={selectedLyricsIndex}
              onChange={(e) => {
                setSelectedLyricsIndex(Number(e.target.value));
                setSelectedLineIndex(null);
              }}
              className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded text-white text-sm"
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
          className="mt-auto px-3 py-2 border border-neutral-600 hover:border-neutral-400 rounded text-neutral-400 hover:text-white text-sm"
        >
          + Nova Versão
        </button>
        {lyricsArray.length > 1 && (
          <button
            onClick={handleRemoveVersion}
            disabled={isDeleting}
            className="disabled:opacity-50 mt-auto px-3 py-2 border border-red-600 hover:border-red-400 rounded text-red-400 hover:text-red-300 text-sm"
          >
            {isDeleting ? "Removendo..." : "Remover Versão"}
          </button>
        )}
      </div>

      {/* Language selector */}
      <div>
        <label className="block mb-1 text-neutral-400 text-xs">Idioma</label>
        <div className="flex flex-wrap gap-2">
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
        className="bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 px-4 py-2 rounded w-full text-white text-sm"
      >
        {isTranslating ? "Traduzindo..." : "Auto Romanizar e Traduzir"}
      </button>

      {/* Lines list */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-neutral-400 text-xs">
            Linhas ({currentLyrics?.lines.length ?? 0})
          </label>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded max-h-64 overflow-y-auto">
          {currentLyrics?.lines.length === 0 ? (
            <p className="p-4 text-neutral-500 text-sm">
              Nenhuma linha. Clique em &quot;Adicionar Linha&quot;.
            </p>
          ) : (
            currentLyrics?.lines.map((line, index) => {
              const text = line.texts.find(
                (t) => t.languageId === selectedLanguage,
              );
              return (
                <div
                  key={line.id}
                  onClick={() => setSelectedLineIndex(index)}
                  className={`p-3 border-b border-neutral-700 cursor-pointer ${
                    selectedLineIndex === index
                      ? "bg-neutral-700"
                      : "hover:bg-neutral-750"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 text-xs">#{index}</span>
                    <span className="text-neutral-500 text-xs">
                      {line.start} — {line.end}
                    </span>
                  </div>
                  <p className="mt-0.5 text-white text-sm">
                    {text?.text || (
                      <span className="text-neutral-600 italic">vazio</span>
                    )}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected line editor */}
      {selectedLine && (
        <div className="space-y-3 bg-neutral-800 p-4 border border-neutral-700 rounded">
          <label className="block text-neutral-400 text-xs">Editar Linha</label>
          <textarea
            value={selectedText?.text ?? ""}
            onChange={(e) => handleLineTextChange(e.target.value)}
            rows={3}
            placeholder="Texto da linha..."
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white text-sm"
          />
          <div className="gap-3 grid grid-cols-3">
            <div>
              <label className="block mb-1 text-neutral-400 text-xs">
                Posição
              </label>
              <div className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded text-neutral-400 text-sm text-center">
                {selectedLineIndex}
              </div>
            </div>
            <div>
              <label className="block mb-1 text-neutral-400 text-xs">
                Start
              </label>
              <input
                type="text"
                value={selectedLine.start}
                onChange={(e) => handleLineFieldChange("start", e.target.value)}
                placeholder="00:00:00.00"
                className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white text-sm"
              />
            </div>
            <div>
              <label className="block mb-1 text-neutral-400 text-xs">End</label>
              <input
                type="text"
                value={selectedLine.end}
                onChange={(e) => handleLineFieldChange("end", e.target.value)}
                placeholder="00:00:00.00"
                className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded w-full text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleRemoveLine}
          disabled={selectedLineIndex === null}
          type="button"
          className="disabled:opacity-40 px-4 py-2 border border-neutral-600 rounded text-neutral-300 hover:text-white text-sm disabled:cursor-not-allowed"
        >
          Remover Linha
        </button>
        <button
          onClick={handleAddLine}
          type="button"
          className="bg-neutral-700 hover:bg-neutral-600 px-4 py-2 rounded text-white text-sm"
        >
          Adicionar Linha
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          type="button"
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white text-sm"
        >
          Importar Letras
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          type="button"
          className="bg-white hover:bg-neutral-200 disabled:opacity-50 ml-auto px-6 py-2 rounded font-semibold text-black text-sm"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <LyricsImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportLyrics}
        isLoading={isImporting}
      />
    </div>
  );
}
