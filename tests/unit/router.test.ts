import { describe, expect, it } from 'vitest';
import { parseHash } from '../../src/lib/router';

describe('parseHash', () => {
  it('maps each screen to its hash route', () => {
    expect(parseHash('#/library')).toEqual({ name: 'library' });
    expect(parseHash('#/add')).toEqual({ name: 'add' });
    expect(parseHash('#/workout')).toEqual({ name: 'workout' });
    expect(parseHash('#/settings')).toEqual({ name: 'settings' });
    expect(parseHash('#/edit/abc-123')).toEqual({ name: 'edit', id: 'abc-123' });
  });

  it('decodes clip ids and falls back to the Library for unknown or empty hashes', () => {
    expect(parseHash('#/edit/a%20b')).toEqual({ name: 'edit', id: 'a b' });
    expect(parseHash('')).toEqual({ name: 'library' });
    expect(parseHash('#/nope')).toEqual({ name: 'library' });
    expect(parseHash('#/edit/')).toEqual({ name: 'library' });
  });
});
