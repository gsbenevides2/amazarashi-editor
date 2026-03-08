"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";

import { importLyricsFromJson, LyricsJsonInput } from "@/app/_actions/lyrics";

export default function LyricsImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [songId, setSongId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    lyricsId?: string;
    lineCount?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/json") {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setJsonText(text);
      };
      reader.readAsText(file);
    } else {
      alert("Por favor, selecione um arquivo JSON válido.");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!songId.trim()) {
      alert("Por favor, insira o ID da música.");
      return;
    }

    if (!jsonText.trim()) {
      alert(
        "Por favor, carregue um arquivo JSON ou cole o JSON no campo de texto.",
      );
      return;
    }

    setResult(null);

    startTransition(async () => {
      try {
        const lyricsData = JSON.parse(jsonText) as LyricsJsonInput[];

        const newLyrics = await importLyricsFromJson(songId.trim(), lyricsData);

        setResult({
          success: true,
          lyricsId: newLyrics.id,
          lineCount: newLyrics.lines.length,
        });

        setSelectedFile(null);
        setJsonText("");
        setSongId("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Erro desconhecido";
        setResult({ error: errorMessage });
      }
    });
  };

  const handleViewLyrics = () => {
    if (result?.lyricsId && songId) {
      router.push(`/songs/${songId}/lyrics`);
    }
  };

  return (
    <div className="mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/songs"
          className="text-neutral-400 hover:text-white text-sm"
        >
          ← Voltar para Músicas
        </Link>
        <h1 className="mt-4 font-bold text-white text-3xl">
          Importar Letras via JSON
        </h1>
        <p className="mt-2 text-neutral-400">
          Importe letras de músicas a partir de arquivos JSON com múltiplos
          idiomas e timestamps.
        </p>
      </div>

      <div className="bg-neutral-800 p-6 rounded-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="songId"
              className="block mb-2 font-medium text-white text-sm"
            >
              ID da Música <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="songId"
              value={songId}
              onChange={(e) => setSongId(e.target.value)}
              className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-white w-full text-white"
              placeholder="Digite o ID da música"
              disabled={isPending}
            />
          </div>

          <div>
            <label
              htmlFor="fileUpload"
              className="block mb-2 font-medium text-white text-sm"
            >
              Arquivo JSON
            </label>
            <input
              ref={fileInputRef}
              type="file"
              id="fileUpload"
              accept=".json"
              onChange={handleFileUpload}
              className="bg-neutral-700 hover:file:bg-neutral-500 file:bg-neutral-600 file:mr-4 px-3 file:px-4 py-2 file:py-2 border border-neutral-600 file:border-0 rounded-md file:rounded-md focus:outline-none focus:ring-2 focus:ring-white w-full file:font-medium text-white file:text-white file:text-sm"
              disabled={isPending}
            />
            {selectedFile && (
              <p className="mt-2 text-green-400 text-sm">
                Arquivo selecionado: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="jsonText"
              className="block mb-2 font-medium text-white text-sm"
            >
              Ou cole o JSON diretamente
            </label>
            <textarea
              id="jsonText"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              className="bg-neutral-700 px-3 py-2 border border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-white w-full font-mono text-white text-sm"
              placeholder={`Exemplo de formato esperado:
[
  {
    "hiragana": "応答せよ、応答せよ",
    "romanji": "Ōtō seyo, ōtō seyo",
    "portuguese": "Responda, responda",
    "start": "00:00:09.66",
    "end": "00:00:15.32"
  },
  {
    "hiragana": "僕らの声が聞こえますか",
    "romanji": "Bokura no koe ga kikoemasu ka",
    "portuguese": "Vocês conseguem ouvir nossa voz?",
    "start": "00:00:15.32",
    "end": "00:00:21.15"
  }
]`}
              disabled={isPending}
            />
          </div>

          <div className="bg-neutral-700 p-4 rounded-md">
            <h3 className="mb-2 font-medium text-white text-sm">
              Formato esperado:
            </h3>
            <ul className="space-y-1 text-neutral-300 text-sm">
              <li>• Array de objetos JSON</li>
              <li>
                • Cada objeto deve conter: <code>hiragana</code>,{" "}
                <code>romanji</code>, <code>portuguese</code>,{" "}
                <code>start</code>, <code>end</code>
              </li>
              <li>
                • Timestamps no formato: <code>"00:00:09.66"</code>
              </li>
              <li>• Os textos devem estar nos idiomas correspondentes</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || !songId.trim() || !jsonText.trim()}
              className="bg-white hover:bg-neutral-200 disabled:opacity-50 px-6 py-2 rounded font-semibold text-black disabled:cursor-not-allowed"
            >
              {isPending ? "Importando..." : "Importar Letras"}
            </button>
          </div>
        </form>

        {result && (
          <div
            className={`mt-6 p-4 rounded-md ${result.success ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
          >
            {result.success ? (
              <div>
                <h3 className="font-medium">
                  ✅ Importação realizada com sucesso!
                </h3>
                <p className="mt-1">
                  {result.lineCount} linha{result.lineCount !== 1 ? "s" : ""}{" "}
                  importada{result.lineCount !== 1 ? "s" : ""} com sucesso.
                </p>
                <button
                  onClick={handleViewLyrics}
                  className="bg-green-600 hover:bg-green-700 mt-3 px-4 py-2 rounded text-white text-sm"
                >
                  Ver Letras Importadas
                </button>
              </div>
            ) : (
              <div>
                <h3 className="font-medium">❌ Erro na importação</h3>
                <p className="mt-1">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
