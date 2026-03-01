"use client";

import { useState } from "react";
import Modal from "./Modal";

interface LyricsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string) => void;
  isLoading?: boolean;
}

export default function LyricsImportModal({
  isOpen,
  onClose,
  onImport,
  isLoading,
}: LyricsImportModalProps) {
  const [lyricsText, setLyricsText] = useState("");

  const handleImport = () => {
    if (lyricsText.trim()) {
      onImport(lyricsText.trim());
    }
  };

  const handleClose = () => {
    setLyricsText("");
    onClose();
  };

  const lineCount = lyricsText
    .trim()
    .split("\n")
    .filter((line) => line.trim()).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Letras">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="lyrics-textarea"
            className="block mb-2 font-medium text-white text-sm"
          >
            Cole a letra completa aqui:
          </label>
          <textarea
            id="lyrics-textarea"
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 focus:border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-white w-full h-64 text-white resize-none placeholder-neutral-400"
            placeholder="Cole a letra da música aqui...\nCada linha será uma nova entrada na sincronização."
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {lineCount > 0 && (
          <div className="bg-neutral-700 p-2 rounded text-neutral-300 text-sm">
            <strong>Preview:</strong> {lineCount} linha
            {lineCount !== 1 ? "s" : ""} será{lineCount !== 1 ? "ão" : ""}{" "}
            criada{lineCount !== 1 ? "s" : ""} com 5 segundos cada.
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            className="bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 px-4 py-2 border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-800 font-medium text-neutral-300 text-sm"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="bg-white hover:bg-neutral-100 disabled:opacity-50 px-4 py-2 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-800 font-medium text-black text-sm"
            onClick={handleImport}
            disabled={!lyricsText.trim() || isLoading}
          >
            {isLoading ? "Importando..." : "Importar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
