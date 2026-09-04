import { describe, expect, it } from 'vitest';
import { ema, macd, rsi, sma } from './indicators';

describe('indicators', () => {
  it('sma is null until the window fills, then the plain average', () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBeCloseTo(2);
    expect(out[4]).toBeCloseTo(4);
  });

  it('ema starts from the sma seed and follows the series', () => {
    const flat = ema(new Array(20).fill(10), 5);
    expect(flat[19]).toBeCloseTo(10);
  });

  it('rsi is 100 on a series that only rises and 0 on one that only falls', () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    const down = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(rsi(up, 14)[29]).toBeCloseTo(100);
    expect(rsi(down, 14)[29]).toBeCloseTo(0);
  });

  it('macd histogram is macd minus signal where both exist', () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 5);
    const { macd: line, signal, histogram } = macd(series);
    const i = 59;
    expect(histogram[i]).toBeCloseTo((line[i] as number) - (signal[i] as number));
  });
});
