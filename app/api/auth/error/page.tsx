import Link from "next/link";

export default function ErrorPage() {
  return (
    <div className="flex justify-center items-center bg-neutral-900 min-h-screen text-white">
      <div className="text-center">
        <h1 className="mb-4 font-bold text-4xl">Ops!</h1>
        <p className="mb-6 text-lg">
          Algo deu errado. Por favor, tente novamente.
        </p>
        <Link
          href="/"
          className="inline-block bg-neutral-800 hover:bg-neutral-700 px-6 py-3 rounded text-white transition-colors"
        >
          Voltar para a página inicial
        </Link>
      </div>
    </div>
  );
}
