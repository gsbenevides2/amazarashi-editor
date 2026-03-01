'use client';

import { useState } from 'react';
import Modal from './Modal';

interface LyricsImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (text: string) => void;
  isLoading?: boolean;
}

export default function LyricsImportModal({ isOpen, onClose, onImport, isLoading }: LyricsImportModalProps) {
  const [lyricsText, setLyricsText] = useState('');

  const handleImport = () => {
    if (lyricsText.trim()) {
      onImport(lyricsText.trim());
    }
  };

  const handleClose = () => {
    setLyricsText('');
    onClose();
  };

  const lineCount = lyricsText.trim().split('\n').filter(line => line.trim()).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Letras">
      <div className="space-y-4">
        <div>
          <label htmlFor="lyrics-textarea" className="block text-sm font-medium text-white mb-2">
            Cole a letra completa aqui:
          </label>
          <textarea
            id="lyrics-textarea"
            className="w-full h-64 px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-md text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent resize-none"
            placeholder="Cole a letra da música aqui...\nCada linha será uma nova entrada na sincronização."
            value={lyricsText}
            onChange={(e) => setLyricsText(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        {lineCount > 0 && (
          <div className="text-sm text-neutral-300 bg-neutral-700 p-2 rounded">
            <strong>Preview:</strong> {lineCount} linha{lineCount !== 1 ? 's' : ''} será{lineCount !== 1 ? 'ão' : ''} criada{lineCount !== 1 ? 's' : ''} com 5 segundos cada.
          </div>
        )}
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-neutral-300 bg-neutral-700 border border-neutral-600 rounded-md hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-800 disabled:opacity-50"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-black bg-white border border-transparent rounded-md hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-800 disabled:opacity-50"
            onClick={handleImport}
            disabled={!lyricsText.trim() || isLoading}
          >
            {isLoading ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}