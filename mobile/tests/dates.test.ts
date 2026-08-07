import { formatDateKey, todayDateKey } from '../src/utils/dates';

describe('formatDateKey', () => {
  it('formats a date as YYYY-MM-DD using LOCAL components', () => {
    const d = new Date(2025, 0, 5, 12, 30); // Jan 5, 2025 local
    expect(formatDateKey(d)).toBe('2025-01-05');
  });

  it('zero-pads month and day', () => {
    expect(formatDateKey(new Date(2025, 11, 31))).toBe('2025-12-31');
    expect(formatDateKey(new Date(2025, 2, 7))).toBe('2025-03-07');
  });

  it('does not drift across UTC boundary — uses local date components', () => {
    // A local date just after midnight local: 2025-06-01 00:30 local.
    const d = new Date(2025, 5, 1, 0, 30);
    // In a timezone behind UTC this would still be June 1 locally, not May 31 (UTC).
    expect(formatDateKey(d)).toBe('2025-06-01');
  });

  it('uses the full four-digit year (no rollover issues before 2000)', () => {
    expect(formatDateKey(new Date(1999, 0, 1))).toBe('1999-01-01');
    expect(formatDateKey(new Date(2100, 11, 31))).toBe('2100-12-31');
  });
});

describe('todayDateKey', () => {
  it('returns the local date key for now', () => {
    const realNow = new Date();
    expect(todayDateKey()).toBe(formatDateKey(realNow));
  });
});
