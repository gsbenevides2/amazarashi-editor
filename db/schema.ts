import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const albunsTable = sqliteTable("albuns", {
  id: text("id").primaryKey(),
  nameRomaji: text("name_romanji").notNull(),
  nameHiragana: text("name_hiragana").notNull(),
  nameEnglish: text("name_english").notNull(),
  namePortuguese: text("name_portuguese").notNull(),
  image: text("image").notNull(),
  releaseDate: text("release_date")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const musicsTable = sqliteTable("musics", {
  id: text("id").primaryKey(),
  nameRomaji: text("name_romanji").notNull(),
  nameHiragana: text("name_hiragana").notNull(),
  nameEnglish: text("name_english").notNull(),
  namePortuguese: text("name_portuguese").notNull(),
  duration: integer("duration").notNull(),
  youtubeVideoClipId: text("youtube_video_clip_id"),
  youtubeMusicId: text("youtube_music_id"),
  spotifyId: text("spotify_id"),
  videoClipCoverUrl: text("video_clip_cover_url").notNull(),
  description: text("description"),
  releaseDate: text("release_date")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const musics_albumsTable = sqliteTable("musics_albums", {
  musicId: text("music_id")
    .references(() => musicsTable.id)
    .notNull(),
  albumId: text("album_id")
    .references(() => albunsTable.id)
    .notNull(),
  position: integer("position").notNull(),
});

export const languagesTable = sqliteTable("languages", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const lyricsTable = sqliteTable("lyrics", {
  id: text("id").primaryKey(),
  musicId: text("music_id")
    .references(() => musicsTable.id)
    .notNull(),
});

export const lyrics_lines = sqliteTable("lyrics_lines", {
  id: text("id").primaryKey(),
  lyricsId: text("lyrics_id")
    .references(() => lyricsTable.id)
    .notNull(),
  position: integer("position").notNull(),
  start: text("start")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  end: text("end")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

export const lyrics_lines_texts = sqliteTable("lyrics_lines_texts", {
  id: text("id").primaryKey(),
  lyricsLineId: text("lyrics_line_id")
    .references(() => lyrics_lines.id)
    .notNull(),
  languageId: text("language_id")
    .references(() => languagesTable.id)
    .notNull(),
  text: text("text").notNull(),
});

export const sessionsTable = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey().notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  logged: integer("logged", { mode: "boolean" }).notNull().default(false),
});
