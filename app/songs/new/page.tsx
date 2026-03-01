import NewSongForm from "@/app/_components/NewSongForm";

export const dynamic = "force-dynamic";

export default function NewSongPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-bold text-2xl">Adicionar Nova Música</h1>
      <NewSongForm />
    </div>
  );
}
