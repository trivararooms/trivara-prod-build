import { describe, it, expect } from 'vitest';
import { generatedArtSvg, generatedArtUrl } from './generatedArt';

describe('generatedArt', () => {
  it('is deterministic for the same options', () => {
    expect(generatedArtSvg({ hue: 40, variant: 2 })).toBe(generatedArtSvg({ hue: 40, variant: 2 }));
  });

  it('changes with the variant', () => {
    expect(generatedArtSvg({ variant: 0 })).not.toBe(generatedArtSvg({ variant: 1 }));
  });

  it('produces a css url() with an encoded svg', () => {
    const url = generatedArtUrl({ hue: 200, water: true });
    expect(url.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(url).toContain(encodeURIComponent('<svg'));
  });

  it('can omit the house silhouette', () => {
    expect(generatedArtSvg({ house: true })).toContain('<g fill=');
    expect(generatedArtSvg({ house: false })).not.toContain('<g fill=');
  });
});
