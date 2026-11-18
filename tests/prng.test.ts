import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/engine/prng';

describe('PRNG Determinism & Distribution', () => {
  it('produces identical sequences given the same seed', () => {
    const prng1 = new PRNG(12345);
    const prng2 = new PRNG(12345);

    for (let i = 0; i < 100; i++) {
      expect(prng1.next()).toBe(prng2.next());
    }
  });

  it('produces different sequences for different seeds', () => {
    const prng1 = new PRNG(111);
    const prng2 = new PRNG(222);

    let identicalCount = 0;
    for (let i = 0; i < 50; i++) {
      if (prng1.next() === prng2.next()) {
        identicalCount++;
      }
    }
    expect(identicalCount).toBeLessThan(5);
  });

  it('nextInt generates integers strictly within bounds', () => {
    const prng = new PRNG(999);
    for (let i = 0; i < 200; i++) {
      const val = prng.nextInt(5, 15);
      expect(val).toBeGreaterThanOrEqual(5);
      expect(val).toBeLessThanOrEqual(15);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it('pick selects valid elements from arrays', () => {
    const prng = new PRNG(777);
    const items = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
    for (let i = 0; i < 50; i++) {
      const item = prng.pick(items);
      expect(items).toContain(item);
    }
  });
});
