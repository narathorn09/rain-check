/**
 * Volume control with a look-ahead peak limiter, so speech can be made much louder on small
 * phone speakers without ever clipping (clipping is heard as crackle). Offline tests showed
 * the Web Audio compressor cannot do this: its attack lets peaks through, so turning the level
 * up barely raised loudness while peaks went past full scale.
 *
 * It runs inside the playback AudioWorklet (the class source is copied into it), so it must
 * stay plain, self-contained JavaScript: no imports, no outside references.
 */
export class Limiter {
  gain: number;
  private readonly ceiling: number;
  private readonly look: number;
  private readonly delay: Float32Array;
  private readonly need: Float32Array;
  private pos = 0;
  private g = 1;
  private readonly attack: number;
  private readonly release: number;
  // Monotonic queue (indices into `need`) giving the smallest gain needed in the look-ahead window.
  private readonly q: Int32Array;
  private head = 0;
  private tail = 0;
  private n = 0;

  constructor(sampleRate: number, gain = 1, ceiling = 0.9) {
    this.gain = gain;
    this.ceiling = ceiling;
    this.look = Math.max(1, Math.round(sampleRate * 0.004));
    this.delay = new Float32Array(this.look);
    this.need = new Float32Array(this.look);
    this.q = new Int32Array(this.look + 1);
    // Reach a needed gain within the look-ahead; recover over ~60 ms, quick enough for the
    // quiet syllables after a loud one, slow enough not to flutter.
    this.attack = 1 - Math.exp(-4 / this.look);
    this.release = 1 - Math.exp(-1 / (sampleRate * 0.06));
  }

  /** Takes one sample, returns the sample from `look` samples ago at the new level. */
  process(x: number): number {
    const v = x * this.gain;
    const a = Math.abs(v);
    const req = a > this.ceiling ? this.ceiling / a : 1;

    const slot = this.pos;
    const out = this.delay[slot];
    const outNeed = this.n >= this.look ? this.need[slot] : 1;
    this.delay[slot] = v;
    this.need[slot] = req;
    const idx = this.n;
    this.n++;
    this.pos = (this.pos + 1) % this.look;

    // Keep the queue increasing so its head is the minimum of the last `look` samples.
    const cap = this.q.length;
    while (this.tail !== this.head) {
      const last = (this.tail - 1 + cap) % cap;
      if (this.need[this.q[last] % this.look] > req) this.tail = last;
      else break;
    }
    this.q[this.tail] = idx;
    this.tail = (this.tail + 1) % cap;
    while (this.q[this.head] <= idx - this.look) this.head = (this.head + 1) % cap;
    const target = this.need[this.q[this.head] % this.look];

    this.g += (target - this.g) * (target < this.g ? this.attack : this.release);
    // The hard minimum guarantees the ceiling even if the smooth gain is still catching up.
    return out * Math.min(this.g, outNeed);
  }
}
