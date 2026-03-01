"use client";

import { useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="z-50 fixed inset-0 overflow-y-auto">
      <div className="flex justify-center items-end sm:items-center p-4 sm:p-0 min-h-full text-center">
        <div
          className="fixed inset-0 bg-neutral-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        <div className="relative bg-neutral-800 shadow-xl sm:my-8 sm:p-6 px-4 pt-5 pb-4 rounded-lg sm:w-full sm:max-w-lg overflow-hidden text-left transition-all transform">
          <div className="flex justify-between items-center pb-4">
            <h3 className="font-semibold text-white text-lg leading-6">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-800 text-neutral-400 hover:text-white"
            >
              <span className="sr-only">Fechar</span>
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
