// Chrome on Android tends to stop a long utterance part-way, so speech is queued in short chunks.
export const MAX_CHUNK = 120;

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
