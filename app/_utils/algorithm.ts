// ── Types ─────────────────────────────────────────────────────────────────────

interface ResponseWord {
  word: string;
  // New format
  start?: string;
  end?: string;
  // Legacy format
  startSeconds?: string;
  startNanos?: string;
  endSeconds?: string;
  endNanos?: string;
}

interface LyricText {
  id: string;
  languageId: string;
  text: string;
}

interface LyricLine {
  id: string;
  position: number;
  start: string;
  end: string;
  texts: LyricText[];
}

interface Input {
  success: boolean;
  data: {
    response: ResponseWord[];
    lyrics: {
      id: string;
      musicId: string;
      lines: LyricLine[];
    };
  };
}

interface SyncedLine {
  position: number;
  start: string;
  end: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSec(ts: string): number {
  const [h, m, s] = ts.split(":");
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(s);
}

function wordStartSec(w: ResponseWord): number {
  if (w.start) return toSec(w.start);
  return parseInt(w.startSeconds!) + parseInt(w.startNanos!) / 1_000_000_000;
}

function wordEndSec(w: ResponseWord): number {
  if (w.end) return toSec(w.end);
  return parseInt(w.endSeconds!) + parseInt(w.endNanos!) / 1_000_000_000;
}

function secToTs(s: number): string {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const secs = (s - m * 60).toFixed(2).padStart(5, "0");
  return `00:${String(m).padStart(2, "0")}:${secs}`;
}

function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\s、。！？・，,.!?「」『』（）()\[\]\u3000]+/g, "");
}

function lcsLen(a: string, b: string): number {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let l = 0;
      while (i + l < a.length && j + l < b.length && a[i + l] === b[j + l]) l++;
      if (l > best) best = l;
    }
  }
  return best;
}

function commonChars(a: string, b: string): number {
  const freq = (s: string) =>
    [...s].reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>());
  const fa = freq(a);
  const fb = freq(b);
  let total = 0;
  for (const [c, n] of fa) total += Math.min(n, fb.get(c) ?? 0);
  return total;
}

function scoreMatch(normLine: string, accumulated: string): number {
  if (!accumulated || !normLine) return 0;
  const lcs = lcsLen(normLine, accumulated);
  const lcsScore = lcs / normLine.length;
  const charScore = commonChars(normLine, accumulated) / normLine.length;
  const lengthRatio =
    Math.min(normLine.length, accumulated.length) /
    Math.max(normLine.length, accumulated.length);
  return (0.6 * lcsScore + 0.4 * charScore) * (0.5 + 0.5 * lengthRatio);
}

// ── Core algorithm ────────────────────────────────────────────────────────────

const THRESHOLD = 0.3;

function matchAll(
  lines: LyricLine[],
  words: ResponseWord[]
): Array<{ start: number | null; end: number | null; score: number }> {
  const results: Array<{ start: number | null; end: number | null; score: number }> = [];
  let wordIdx = 0;

  for (const line of lines) {
    const hiragana = line.texts.find((t) => t.languageId === "hiragana")?.text ?? "";
    const normLine = normalize(hiragana);

    if (!normLine || wordIdx >= words.length) {
      results.push({ start: null, end: null, score: 0 });
      continue;
    }

    let bestScore = 0, bestI = wordIdx, bestJ = wordIdx;
    const searchStart = Math.max(0, wordIdx - 3);
    const searchEnd = Math.min(wordIdx + 80, words.length);

    for (let i = searchStart; i < searchEnd; i++) {
      let accumulated = "";
      for (let j = i; j < Math.min(i + 60, words.length); j++) {
        accumulated += normalize(words[j].word);
        const score = scoreMatch(normLine, accumulated);
        if (score > bestScore) { bestScore = score; bestI = i; bestJ = j; }
        if (accumulated.length > normLine.length * 2.5) break;
      }
    }

    if (bestScore >= THRESHOLD) {
      let start = wordStartSec(words[bestI]);
      let end = wordEndSec(words[bestJ]);
      if (end <= start) end = start + 2.0;
      wordIdx = bestJ + 1;
      results.push({ start, end, score: bestScore });
    } else {
      results.push({ start: null, end: null, score: bestScore });
    }
  }

  return results;
}

function interpolate(
  results: Array<{ start: number | null; end: number | null; score: number }>,
  words: ResponseWord[]
): void {
  const n = results.length;
  const matched = new Map<number, { start: number; end: number }>();
  results.forEach((r, i) => {
    if (r.start !== null && r.end !== null) matched.set(i, { start: r.start, end: r.end });
  });

  for (let i = 0; i < n; i++) {
    if (results[i].start !== null) continue;

    const prevKeys = [...matched.keys()].filter((k) => k < i);
    const nextKeys = [...matched.keys()].filter((k) => k > i);
    const prev = prevKeys.length ? Math.max(...prevKeys) : null;
    const next = nextKeys.length ? Math.min(...nextKeys) : null;

    if (prev !== null && next !== null) {
      const gap = matched.get(next)!.start - matched.get(prev)!.end;
      const unmatched = Array.from({ length: next - prev - 1 }, (_, k) => prev + 1 + k).filter(
        (j) => results[j].start === null
      );
      if (gap > 0 && unmatched.length) {
        const slot = gap / unmatched.length;
        unmatched.forEach((j, k) => {
          const s = matched.get(prev)!.end + k * slot;
          const e = s + slot * 0.95;
          results[j] = { ...results[j], start: s, end: e };
          matched.set(j, { start: s, end: e });
        });
      }
    } else if (prev !== null) {
      // After last match: 4s per line
      const tail = Array.from({ length: n - prev - 1 }, (_, k) => prev + 1 + k).filter(
        (j) => results[j].start === null
      );
      tail.forEach((j, k) => {
        const s = matched.get(prev)!.end + k * 4.0;
        results[j] = { ...results[j], start: s, end: s + 3.5 };
      });
    } else if (next !== null) {
      // Before first match
      const head = Array.from({ length: next }, (_, k) => k).filter(
        (j) => results[j].start === null
      );
      head.reverse().forEach((j, k) => {
        const e = matched.get(next)!.start - k * 4.0;
        results[j] = { ...results[j], start: Math.max(0, e - 3.5), end: Math.max(0, e) };
      });
    }
  }
}

function fixEnds(
  results: Array<{ start: number | null; end: number | null; score: number }>
): void {
  for (let i = 0; i < results.length - 1; i++) {
    const curr = results[i];
    const next = results[i + 1];
    if (curr.start !== null && next.start !== null) {
      curr.end = Math.max(curr.start + 0.5, next.start);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function syncLyrics(input: Input): SyncedLine[] {
  const words = input.data.response;
  const lines = input.data.lyrics.lines;

  const results = matchAll(lines, words);
  interpolate(results, words);
  fixEnds(results);

  return lines.map((line, i) => ({
    position: line.position,
    start: secToTs(results[i].start ?? toSec(line.start)),
    end: secToTs(results[i].end ?? toSec(line.end)),
  }));
}