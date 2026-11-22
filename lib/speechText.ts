// Chrome on Android tends to stop a long utterance part-way, so speech is queued in short chunks.
export const MAX_CHUNK = 120;

// Sentence ends in the assistant's Thai: polite particles, or ordinary punctuation.
const SENTENCE_END = /(ค่ะ|คะ|ครับ|[.!?。\n])(?=\s|$)/g;
// Shorter pieces would mean many tiny TTS calls with choppy joins.
const MIN_SENTENCE = 12;
// A run this long without an ending is cut at its last space so speech can start.
const MAX_SENTENCE = 110;

/**
 * Splits streaming text into sentences ready to speak. Returns the complete ones and the
 * unfinished remainder to keep buffering. With `final`, the remainder is flushed too.
 */
export function takeSentences(text: string, final = false): { ready: string[]; rest: string } {
  const ready: string[] = [];
  let pendingFrom = 0;
  for (const m of text.matchAll(SENTENCE_END)) {
    const end = (m.index ?? 0) + m[0].length;
    // A short piece stays pending and joins the next sentence.
    if (end - pendingFrom >= MIN_SENTENCE) {
      ready.push(text.slice(pendingFrom, end).trim());
      pendingFrom = end;
    }
  }
  let rest = text.slice(pendingFrom);
  if (!final && rest.length > MAX_SENTENCE) {
    const cut = rest.lastIndexOf(" ", MAX_SENTENCE);
    if (cut >= MIN_SENTENCE) {
      ready.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut);
    }
  }
  if (final && rest.trim()) {
    ready.push(rest.trim());
    rest = "";
  }
  return { ready: ready.filter(Boolean), rest };
}

/**
 * Splits text into chunks of at most `max` characters, breaking at spaces
 * (Thai puts spaces between phrases) or sentence punctuation.
 */
export function splitForSpeech(text: string, max = MAX_CHUNK): string[] {
  const parts = text
    .replace(/\s+/g, " ")
    .split(/(?<=[ .!?。])/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    // A single run with no break points is cut hard so no chunk exceeds the limit.
    for (let i = 0; i < part.length; i += max) {
      const piece = part.slice(i, i + max);
      if (current && current.length + 1 + piece.length > max) {
        chunks.push(current);
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
