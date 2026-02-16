import { describe, expect, it } from 'vitest';
import { compareVersions } from './updateService';

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('handles prefixed versions', () => {
    expect(compareVersions('v1.2.3', '1.2.2')).toBe(1);
  });

  it('handles missing patch numbers', () => {
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });

  it('compares larger major versions correctly', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });
});
