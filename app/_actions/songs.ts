"use server";

import { eq, asc } from "drizzle-orm";

import { invalidateISG } from "@/app/_utils/invalidateISG";
import { connectToDatabase } from "@/db";
import { musicsTable, musics_albumsTable, albunsTable } from "@/db/schema";

export type SongInput = {
  id?: string;
  nameRomaji: string;
  nameHiragana: string;
  nameEnglish: string;
  namePortuguese: string;
  duration: number;
  youtubeVideoClipId?: string | null;
  youtubeMusicId?: string | null;
  spotifyId?: string | null;
  videoClipCoverUrl: string;
  description?: string | null;
  releaseDate: string;
};

export async function getSongs() {
  const db = connectToDatabase();
  const songs = await db.select().from(musicsTable);

  const withAlbums = await Promise.all(
    songs.map(async (song) => {
      const albumRows = await db
        .select({ id: albunsTable.id, nameRomaji: albunsTable.nameRomaji })
        .from(musics_albumsTable)
        .leftJoin(albunsTable, eq(musics_albumsTable.albumId, albunsTable.id))
        .where(eq(musics_albumsTable.musicId, song.id))
        .orderBy(asc(musics_albumsTable.position));

      return {
        ...song,
        albums: albumRows
          .filter((a) => a.id !== null)
          .map((a) => ({ id: a.id!, nameRomaji: a.nameRomaji! })),
      };
    }),
  );

  return withAlbums;
}

export async function getSong(id: string) {
  const db = connectToDatabase();
  const song = await db
    .select()
    .from(musicsTable)
    .where(eq(musicsTable.id, id))
    .get();
  if (!song) return null;

  const albumRows = await db
    .select({ id: albunsTable.id, nameRomaji: albunsTable.nameRomaji })
    .from(musics_albumsTable)
    .leftJoin(albunsTable, eq(musics_albumsTable.albumId, albunsTable.id))
    .where(eq(musics_albumsTable.musicId, id))
    .orderBy(asc(musics_albumsTable.position));

  return {
    ...song,
    albums: albumRows
      .filter((a) => a.id !== null)
      .map((a) => ({ id: a.id!, nameRomaji: a.nameRomaji! })),
  };
}

export async function createSong(data: SongInput) {
  const db = connectToDatabase();

  // Use o ID fornecido ou gere um novo UUID
  const id = data.id || crypto.randomUUID();

  // Verificar se o ID já existe (se foi fornecido)
  if (data.id) {
    const existing = await db
      .select({ id: musicsTable.id })
      .from(musicsTable)
      .where(eq(musicsTable.id, data.id))
      .get();

    if (existing) {
      throw new Error(
        `Já existe uma música com o ID "${data.id}". Escolha outro ID ou deixe em branco para gerar automaticamente.`,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _, ...songData } = data; // Remove o id do data para evitar duplicação
  await db.insert(musicsTable).values({
    id,
    ...songData,
  });
  invalidateISG();
  return id;
}

export async function updateSong(id: string, data: Partial<SongInput>) {
  const db = connectToDatabase();
  await db.update(musicsTable).set(data).where(eq(musicsTable.id, id));
  invalidateISG();
}
