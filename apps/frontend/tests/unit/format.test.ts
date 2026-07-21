import { describe, it, expect } from 'vitest';
import { initials, isColorAvatar, formatTimeRange, relativeTime } from '@/lib/format';

describe('format helpers', () => {
  it('builds initials from up to two name parts', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('madonna')).toBe('M');
    expect(initials('   ')).toBe('?');
  });

  it('detects color vs URL avatars', () => {
    expect(isColorAvatar('#abcdef')).toBe(true);
    expect(isColorAvatar('http://example.com/a.png')).toBe(false);
  });

  it('formats a time range', () => {
    expect(formatTimeRange('18:00', '20:00')).toContain('18:00');
    expect(formatTimeRange('18:00', '20:00')).toContain('20:00');
    expect(formatTimeRange('18:00', null)).toBe('18:00');
    expect(formatTimeRange(null, null)).toBe('');
  });

  it('reports "just now" for a fresh timestamp', () => {
    expect(relativeTime(new Date().toISOString())).toBe('just now');
  });
});
