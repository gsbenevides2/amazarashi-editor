"use server";

import { eq, asc } from "drizzle-orm";

import { invalidateISG } from "@/app/_utils/invalidateISG";
import { connectToDatabase } from "@/db";
import { albunsTable, musics_albumsTable, musicsTable } from "@/db/schema";

export type AlbumInput = {
  id?: string;
  nameRomaji: string;
  nameHiragana: string;
  nameEnglish: string;
  namePortuguese: string;
  image: string;
  releaseDate: string;
};

export async function getAlbums() {
  const db = connectToDatabase();
  return db.select().from(albunsTable);
}

export async function getAlbum(id: string) {
  const db = connectToDatabase();
  const album = await db
    .select()
    .from(albunsTable)
    .where(eq(albunsTable.id, id))
    .get();
  if (!album) return null;

  const songs = await db
    .select({
      id: musicsTable.id,
      nameRomaji: musicsTable.nameRomaji,
      nameHiragana: musicsTable.nameHiragana,
      position: musics_albumsTable.position,
    })
    .from(musics_albumsTable)
    .leftJoin(musicsTable, eq(musics_albumsTable.musicId, musicsTable.id))
    .where(eq(musics_albumsTable.albumId, id))
    .orderBy(asc(musics_albumsTable.position));

  return {
    ...album,
    songs: songs
      .filter((s) => s.id !== null)
      .map((s) => ({
        id: s.id!,
        nameRomaji: s.nameRomaji!,
        nameHiragana: s.nameHiragana!,
        position: s.position,
      })),
  };
}

export async function createAlbum(data: AlbumInput) {
  const db = connectToDatabase();

  // Use o ID fornecido ou gere um novo UUID
  const id = data.id || crypto.randomUUID();

  // Verificar se o ID já existe (se foi fornecido)
  if (data.id) {
    const existing = await db
      .select({ id: albunsTable.id })
      .from(albunsTable)
      .where(eq(albunsTable.id, data.id))
      .get();

    if (existing) {
      throw new Error(
        `Já existe um álbum com o ID "${data.id}". Escolha outro ID ou deixe em branco para gerar automaticamente.`,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _, ...albumData } = data; // Remove o id do data para evitar duplicação
  await db.insert(albunsTable).values({ id, ...albumData });
  invalidateISG();
  return id;
}

export async function updateAlbum(id: string, data: Partial<AlbumInput>) {
  const db = connectToDatabase();
  await db.update(albunsTable).set(data).where(eq(albunsTable.id, id));
  invalidateISG();
}

export async function addSongToAlbum(albumId: string, songId: string) {
  const db = connectToDatabase();
  const existing = await db
    .select()
    .from(musics_albumsTable)
    .where(eq(musics_albumsTable.albumId, albumId));
  const position = existing.length + 1;
  await db
    .insert(musics_albumsTable)
    .values({ albumId, musicId: songId, position });
  invalidateISG();
}

export async function removeSongFromAlbum(albumId: string, songId: string) {
  const db = connectToDatabase();
  const allForAlbum = await db
    .select()
    .from(musics_albumsTable)
    .where(eq(musics_albumsTable.albumId, albumId))
    .orderBy(asc(musics_albumsTable.position));

  const filtered = allForAlbum.filter((r) => r.musicId !== songId);
  await db
    .delete(musics_albumsTable)
    .where(eq(musics_albumsTable.albumId, albumId));
  if (filtered.length > 0) {
    await db
      .insert(musics_albumsTable)
      .values(filtered.map((r, i) => ({ ...r, position: i + 1 })));
  }
  invalidateISG();
}

export async function setAlbumSongs(albumId: string, songIds: string[]) {
  const db = connectToDatabase();
  await db
    .delete(musics_albumsTable)
    .where(eq(musics_albumsTable.albumId, albumId));
  if (songIds.length > 0) {
    await db
      .insert(musics_albumsTable)
      .values(
        songIds.map((musicId, i) => ({ albumId, musicId, position: i + 1 })),
      );
  }
  invalidateISG();
}
