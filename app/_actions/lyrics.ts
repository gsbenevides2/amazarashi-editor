"use server";

import { eq, asc, inArray } from "drizzle-orm";

import { invalidateISG } from "@/app/_utils/invalidateISG";
import { connectToDatabase } from "@/db";
import {
  lyricsTable,
  lyrics_lines,
  lyrics_lines_texts,
  languagesTable,
} from "@/db/schema";

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
        }),
      );

      return {
        id: lyric.id,
        musicId: lyric.musicId,
        lines: linesWithTexts,
      };
    }),
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
          })),
        );

        // Insert new texts
        const allTexts = lyric.lines.flatMap((line) =>
          line.texts.map((text) => ({
            id: text.id,
            lyricsLineId: line.id,
            languageId: text.languageId,
            text: text.text,
          })),
        );
        if (allTexts.length > 0) {
          await tx.insert(lyrics_lines_texts).values(allTexts);
        }
      }
    }
  });

  invalidateISG();

  return { success: true };
}

export async function createLyricsVersion(songId: string): Promise<string> {
  const db = connectToDatabase();
  const id = crypto.randomUUID();
  await db.insert(lyricsTable).values({ id, musicId: songId });
  invalidateISG();
  return id;
}

export async function deleteLyricsVersion(lyricsId: string) {
  const db = connectToDatabase();

  await db.transaction(async (tx) => {
    // Get existing line IDs for this lyrics version
    const existingLines = await tx
      .select({ id: lyrics_lines.id })
      .from(lyrics_lines)
      .where(eq(lyrics_lines.lyricsId, lyricsId));

    const existingLineIds = existingLines.map((l) => l.id);

    // Delete existing texts for those lines, then delete lines
    if (existingLineIds.length > 0) {
      await tx
        .delete(lyrics_lines_texts)
        .where(inArray(lyrics_lines_texts.lyricsLineId, existingLineIds));
      await tx.delete(lyrics_lines).where(eq(lyrics_lines.lyricsId, lyricsId));
    }

    // Delete the lyrics version itself
    await tx.delete(lyricsTable).where(eq(lyricsTable.id, lyricsId));
  });

  invalidateISG();

  return { success: true };
}

export interface LyricsJsonInput {
  hiragana: string;
  romanji: string;
  portuguese: string;
  start: string;
  end: string;
}

export async function importLyricsFromJson(
  songId: string,
  jsonData: LyricsJsonInput[],
): Promise<Lyrics> {
  const db = connectToDatabase();

  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    throw new Error("Dados JSON inválidos ou vazios.");
  }

  for (const item of jsonData) {
    if (
      !item.hiragana ||
      !item.romanji ||
      !item.portuguese ||
      !item.start ||
      !item.end
    ) {
      throw new Error(
        "Todos os campos (hiragana, romanji, portuguese, start, end) são obrigatórios.",
      );
    }
  }

  const lyricsId = await createLyricsVersion(songId);

  const languages = await db.select().from(languagesTable);
  const hiraganaLang = languages.find((l) => l.id === "hiragana");
  const romanjiLang = languages.find((l) => l.id === "romanji");
  const portugueseLang = languages.find((l) => l.id === "portuguese");

  if (!hiraganaLang || !romanjiLang || !portugueseLang) {
    throw new Error(
      "Idiomas necessários (hiragana, romanji, portuguese) não encontrados no sistema.",
    );
  }

  const lyricsLines: LyricsLine[] = jsonData.map((item, index) => {
    return {
      id: crypto.randomUUID(),
      position: index,
      start: item.start,
      end: item.end,
      texts: [
        {
          id: crypto.randomUUID(),
          languageId: hiraganaLang.id,
          text: item.hiragana,
        },
        {
          id: crypto.randomUUID(),
          languageId: romanjiLang.id,
          text: item.romanji,
        },
        {
          id: crypto.randomUUID(),
          languageId: portugueseLang.id,
          text: item.portuguese,
        },
      ],
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(lyrics_lines).values(
      lyricsLines.map((line) => ({
        id: line.id,
        lyricsId,
        position: line.position,
        start: line.start,
        end: line.end,
      })),
    );

    const allTexts = lyricsLines.flatMap((line) =>
      line.texts.map((text) => ({
        id: text.id,
        lyricsLineId: line.id,
        languageId: text.languageId,
        text: text.text,
      })),
    );

    if (allTexts.length > 0) {
      await tx.insert(lyrics_lines_texts).values(allTexts);
    }
  });

  invalidateISG();

  return {
    id: lyricsId,
    musicId: songId,
    lines: lyricsLines,
  };
}

export async function importLyricsFromText(
  songId: string,
  text: string,
): Promise<Lyrics> {
  const db = connectToDatabase();

  const textLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (textLines.length === 0) {
    throw new Error("Nenhuma linha válida encontrada no texto.");
  }

  const lyricsId = await createLyricsVersion(songId);

  const languages = await db.select().from(languagesTable);
  const hiraganaLanguage = languages.find((l) => l.id === "hiragana");

  if (!hiraganaLanguage) {
    throw new Error("Idioma Hiragana não encontrado no sistema.");
  }

  const lyricsLines: LyricsLine[] = textLines.map((lineText, index) => {
    const startSeconds = index * 5;
    const endSeconds = startSeconds + 5;

    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.00`;
    };

    return {
      id: crypto.randomUUID(),
      position: index,
      start: formatTime(startSeconds),
      end: formatTime(endSeconds),
      texts: [
        {
          id: crypto.randomUUID(),
          languageId: hiraganaLanguage.id,
          text: lineText,
        },
      ],
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(lyrics_lines).values(
      lyricsLines.map((line) => ({
        id: line.id,
        lyricsId,
        position: line.position,
        start: line.start,
        end: line.end,
      })),
    );

    const allTexts = lyricsLines.flatMap((line) =>
      line.texts.map((text) => ({
        id: text.id,
        lyricsLineId: line.id,
        languageId: text.languageId,
        text: text.text,
      })),
    );

    if (allTexts.length > 0) {
      await tx.insert(lyrics_lines_texts).values(allTexts);
    }
  });

  invalidateISG();

  return {
    id: lyricsId,
    musicId: songId,
    lines: lyricsLines,
  };
}
