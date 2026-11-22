/**
 * Removes isolated clicks from streamed speech.
 *
 * Measured Gemini Live audio carries a sudden one- or two-sample spike every few seconds
 * (6 in 16 s, 8 in 14 s; up to 41x the surrounding signal). Speech changes smoothly by
 * comparison, so a spike shows up as a large second difference against its neighbourhood.
 * Each spike is replaced by a straight line between the samples around it.
 */

// The second difference must be this large in absolute terms…
const MIN_KINK = 0.15;
// …and this many times the local average, so loud consonants are left alone.
const RATIO = 12;
// Samples on each side used for the local average.
const WINDOW = 240;
// Samples replaced on each side of a detected spike.
const SPAN = 2;
// Already-played samples kept as read-only context for the next chunk.
const HISTORY = WINDOW + SPAN + 1;

export class Declicker {
  private history = new Float32Array(0);
  private pending = new Float32Array(0);

  /**
   * Feeds the next chunk and returns the samples that are now safe to play. Samples near the
   * end wait for more input (they need look-ahead), so output lags input by about 10 ms.
   * `flush` releases everything, for the end of a clip.
   */
  process(chunk: Float32Array, flush = false): { out: Float32Array<ArrayBuffer>; fixed: number } {
    const h = this.history.length;
    const x = new Float32Array(h + this.pending.length + chunk.length);
    x.set(this.history);
    x.set(this.pending, h);
    x.set(chunk, h + this.pending.length);
    const n = x.length;

    // Everything before `cut` is judged now and emitted; the rest waits for look-ahead.
    const cut = flush ? n : Math.max(h, n - WINDOW - SPAN - 1);
    let fixed = 0;
    // A second pass smooths the small corner a straight-line repair can leave at its ends.
    for (let pass = 0; pass < 2; pass++) {
      const d2 = new Float32Array(n);
      for (let i = 1; i < n - 1; i++) d2[i] = Math.abs(x[i - 1] - 2 * x[i] + x[i + 1]);
      const prefix = new Float64Array(n + 1);
      for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + d2[i];
      for (let i = Math.max(1, h); i < Math.min(cut, n - 1); i++) {
        const lo = Math.max(0, i - WINDOW);
        const hi = Math.min(n - 1, i + WINDOW);
        const local = (prefix[hi + 1] - prefix[lo] - d2[i]) / Math.max(1, hi - lo);
        if (d2[i] > MIN_KINK && d2[i] > local * RATIO) {
          // Never rewrite samples that have already been played.
          const a = Math.max(h - 1, i - SPAN - 1, 0);
          const b = Math.min(n - 1, i + SPAN + 1);
          for (let k = a + 1; k < b; k++) x[k] = x[a] + ((x[b] - x[a]) * (k - a)) / (b - a);
          // Refresh kinks around the repair so the same spike is not flagged twice.
          for (let k = Math.max(1, a); k <= Math.min(n - 2, b); k++) {
            d2[k] = Math.abs(x[k - 1] - 2 * x[k] + x[k + 1]);
          }
          if (pass === 0) fixed++;
        }
      }
    }

    const out = x.slice(h, cut);
    this.history = x.slice(Math.max(0, cut - HISTORY), cut);
    this.pending = x.slice(cut);
    if (flush) this.history = new Float32Array(0);
    return { out, fixed };
  }
}
