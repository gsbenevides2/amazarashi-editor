import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 font-bold text-3xl">Painel Admin — Amazarashi</h1>
      <div className="gap-4 grid grid-cols-1 sm:grid-cols-2">
        <Link
          href="/albums"
          className="block bg-neutral-800 hover:bg-neutral-700 p-6 rounded-lg transition-colors"
        >
          <h2 className="mb-1 font-semibold text-xl">Álbuns</h2>
          <p className="text-neutral-400 text-sm">
            Criar, editar e gerenciar álbuns. Associar músicas.
          </p>
        </Link>
        <Link
          href="/songs"
          className="block bg-neutral-800 hover:bg-neutral-700 p-6 rounded-lg transition-colors"
        >
          <h2 className="mb-1 font-semibold text-xl">Músicas</h2>
          <p className="text-neutral-400 text-sm">
            Editar metadados, letras e sincronização de timing.
          </p>
        </Link>
      </div>
    </div>
  );
}
