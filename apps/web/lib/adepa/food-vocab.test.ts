import { describe, it, expect } from 'vitest';
import { correctFoodNames } from './food-vocab';

describe('correctFoodNames — known mishearings (regression)', () => {
  it('fixes the classic Jollof mishearing', () => {
    expect(correctFoodNames('can I get jello rice')).toContain('Jollof');
  });

  it('fixes the classic Waakye mishearing', () => {
    expect(correctFoodNames('I want walkie')).toContain('Waakye');
  });

  it('fixes Banku', () => {
    expect(correctFoodNames('some bank oo please')).toContain('Banku');
  });

  it('fixes Fufu', () => {
    expect(correctFoodNames('foo foo and soup')).toContain('Fufu');
  });
});

describe('correctFoodNames — generalized phonetic guessing (new variants)', () => {
  it('guesses Waakye from an unlisted phonetic spelling', () => {
    expect(correctFoodNames('give me some warky')).toContain('Waakye');
  });

  it('guesses Jollof from "jelloff"', () => {
    expect(correctFoodNames('jelloff rice please')).toContain('Jollof');
  });

  it('guesses Banku from a doubled-vowel spelling', () => {
    expect(correctFoodNames('do you have bankuu')).toContain('Banku');
  });

  it('guesses Kelewele from "kelliwelli"', () => {
    expect(correctFoodNames('kelliwelli')).toContain('Kelewele');
  });

  it('guesses Tilapia from "tilapiya"', () => {
    expect(correctFoodNames('grilled tilapiya')).toContain('Tilapia');
  });

  it('guesses Kenkey from "kenke"', () => {
    expect(correctFoodNames('kenke and fish')).toContain('Kenkey');
  });

  it('guesses Tuo Zaafi from "twozafi"', () => {
    expect(correctFoodNames('twozafi please')).toContain('Tuo Zaafi');
  });
});

describe('correctFoodNames — does not mangle ordinary English', () => {
  it('leaves a plain sentence with no food words intact', () => {
    expect(correctFoodNames('I would like to order please')).toBe('I would like to order please');
  });

  it('keeps common short words untouched', () => {
    const out = correctFoodNames('can you help me with the order');
    expect(out).toBe('can you help me with the order');
  });

  it('handles empty input', () => {
    expect(correctFoodNames('')).toBe('');
  });
});
