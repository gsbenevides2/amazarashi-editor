"use server";

import { connectToDatabase } from "@/db";
import {
  lyricsTable,
  lyrics_lines,
  lyrics_lines_texts,
  languagesTable,
} from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";

export interface LyricsLineText {
  id: string;
  languageId: string;
  text: string;
}

export interface LyricsLine {
  id: string;
  position: number;
  start: string;
  end: string;
  texts: LyricsLineText[];
}

export interface Lyrics {
  id: string;
  musicId: string;
  lines: LyricsLine[];
}

export async function getLanguages() {
  const db = connectToDatabase();
  return db.select().from(languagesTable).orderBy(asc(languagesTable.name));
}

export async function getLyrics(songId: string): Promise<Lyrics[]> {
  const db = connectToDatabase();

  const lyricsRows = await db
    .select()
    .from(lyricsTable)
    .where(eq(lyricsTable.musicId, songId));

  return Promise.all(
    lyricsRows.map(async (lyric) => {
      const lines = await db
        .select()
        .from(lyrics_lines)
        .where(eq(lyrics_lines.lyricsId, lyric.id))
        .orderBy(asc(lyrics_lines.position));

      const linesWithTexts = await Promise.all(
        lines.map(async (line) => {
          const texts = await db
            .select()
            .from(lyrics_lines_texts)
            .where(eq(lyrics_lines_texts.lyricsLineId, line.id));
          return {
            id: line.id,
            position: line.position,
            start: line.start,
            end: line.end,
            texts: texts.map((t) => ({
              id: t.id,
              languageId: t.languageId,
              text: t.text,
            })),
          };
        })
      );

      return {
        id: lyric.id,
        musicId: lyric.musicId,
        lines: linesWithTexts,
      };
    })
  );
}

export async function saveLyrics(lyricsArray: Lyrics[]) {
  const db = connectToDatabase();

  await db.transaction(async (tx) => {
    for (const lyric of lyricsArray) {
      // Upsert lyrics record
      await tx
        .insert(lyricsTable)
        .values({ id: lyric.id, musicId: lyric.musicId })
        .onConflictDoUpdate({
          target: lyricsTable.id,
          set: { musicId: lyric.musicId },
        });

      // Get existing line IDs for this lyrics version
      const existingLines = await tx
        .select({ id: lyrics_lines.id })
        .from(lyrics_lines)
        .where(eq(lyrics_lines.lyricsId, lyric.id));

      const existingLineIds = existingLines.map((l) => l.id);

      // Delete existing texts for those lines, then delete lines
      if (existingLineIds.length > 0) {
        await tx
          .delete(lyrics_lines_texts)
          .where(inArray(lyrics_lines_texts.lyricsLineId, existingLineIds));
        await tx
          .delete(lyrics_lines)
          .where(eq(lyrics_lines.lyricsId, lyric.id));
      }

      // Insert new lines
      if (lyric.lines.length > 0) {
        await tx.insert(lyrics_lines).values(
          lyric.lines.map((line) => ({
            id: line.id,
            lyricsId: lyric.id,
            position: line.position,
            start: line.start,
            end: line.end,
          }))
        );

        // Insert new texts
        const allTexts = lyric.lines.flatMap((line) =>
          line.texts.map((text) => ({
            id: text.id,
            lyricsLineId: line.id,
            languageId: text.languageId,
            text: text.text,
          }))
        );
        if (allTexts.length > 0) {
          await tx.insert(lyrics_lines_texts).values(allTexts);
        }
      }
    }
  });

  return { success: true };
}

export async function createLyricsVersion(songId: string): Promise<string> {
  const db = connectToDatabase();
  const id = crypto.randomUUID();
  await db.insert(lyricsTable).values({ id, musicId: songId });
  return id;
}
