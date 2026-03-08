"use client";

import { useState } from "react";

import { LyricsJsonInput } from "@/app/_actions/lyrics";
import Modal from "@/app/_components/Modal";

interface LyricsJsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (jsonData: LyricsJsonInput[]) => void;
  isLoading?: boolean;
}

export default function LyricsJsonImportModal({
  isOpen,
  onClose,
  onImport,
  isLoading,
}: LyricsJsonImportModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");

  const handleImport = () => {
    if (jsonText.trim()) {
      try {
        const jsonData = JSON.parse(jsonText.trim());

        // Validar se é um array
        if (!Array.isArray(jsonData)) {
          setJsonError("O JSON deve ser um array de objetos.");
          return;
        }

        // Validar estrutura básica
        const requiredFields = [
          "hiragana",
          "romanji",
          "portuguese",
          "start",
          "end",
        ];
        for (let i = 0; i < jsonData.length; i++) {
          const item = jsonData[i];
          for (const field of requiredFields) {
            if (!item[field]) {
              setJsonError(`Item ${i + 1}: Campo "${field}" é obrigatório.`);
              return;
            }
          }
        }

        setJsonError("");
        onImport(jsonData);
      } catch (error) {
        console.error("Erro ao analisar JSON:", error);
        setJsonError("JSON inválido. Verifique a sintaxe.");
      }
    }
  };

  const handleClose = () => {
    setJsonText("");
    setJsonError("");
    onClose();
  };

  const handleTextChange = (value: string) => {
    setJsonText(value);
    setJsonError(""); // Clear error when user starts typing
  };

  let previewData;
  try {
    previewData = jsonText.trim() ? JSON.parse(jsonText.trim()) : null;
  } catch {
    previewData = null;
  }

  const isValidArray = Array.isArray(previewData);
  const lineCount = isValidArray ? previewData.length : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Importar Letras via JSON"
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="json-textarea"
            className="block mb-2 font-medium text-white text-sm"
          >
            Cole o JSON das letras aqui:
          </label>
          <textarea
            id="json-textarea"
            className="bg-neutral-700 px-3 py-2 border border-neutral-600 focus:border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-white w-full h-64 font-mono text-white text-sm resize-none placeholder-neutral-400"
            placeholder={`Exemplo de formato esperado:
[
  {
    "hiragana": "応答せよ、応答せよ",
    "romanji": "Ōtō seyo, ōtō seyo",
    "portuguese": "Responda, responda",
    "start": "00:00:09.66",
    "end": "00:00:15.32"
  }
]`}
            value={jsonText}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {jsonError && (
          <div className="bg-red-900 p-2 rounded text-red-300 text-sm">
            <strong>Erro:</strong> {jsonError}
          </div>
        )}

        {lineCount > 0 && !jsonError && (
          <div className="bg-neutral-700 p-2 rounded text-neutral-300 text-sm">
            <strong>Preview:</strong> {lineCount} linha
            {lineCount !== 1 ? "s" : ""} será{lineCount !== 1 ? "ão" : ""}{" "}
            criada{lineCount !== 1 ? "s" : ""} com timestamps e textos em 3
            idiomas.
          </div>
        )}

        <div className="bg-neutral-800 p-3 rounded text-neutral-400 text-xs">
          <strong>Formato esperado:</strong>
          <br />
          • Array de objetos JSON
          <br />
          • Cada objeto deve conter: hiragana, romanji, portuguese, start, end
          <br />• Timestamps no formato: &quot;00:00:09.66&quot;
        </div>

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
            disabled={!jsonText.trim() || !!jsonError || isLoading}
          >
            {isLoading ? "Importando..." : "Importar JSON"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
