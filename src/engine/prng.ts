/**
 * Deterministic PRNG implementation using the 32-bit Mulberry32 algorithm.
 * Guarantees 100% reproducible traffic generation, vehicle characteristics,
 * and arrival sequences across runs with identical seeds.
 */
export class PRNG {
  private s: number;

  constructor(seed: number = 42) {
    this.s = seed >>> 0;
  }

  /**
   * Returns a pseudo-random floating-point number in [0, 1).
   */
  public next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a pseudo-random integer in [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Returns a pseudo-random float in [min, max).
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Picks a random element from an array.
   */
  public pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /**
   * Creates a sub-generator derived from the current state.
   */
  public fork(offset: number = 1): PRNG {
    return new PRNG(this.s + offset);
  }

  public getSeed(): number {
    return this.s;
  }
}
