// Local-timezone date-key helpers — Phase 6.
// The rest of the app (Dashboard, Calendar, Progress week bars) builds its
// "today" from local date components; these keep every consumer on the same,
// local definition instead of mixing in UTC via toISOString().

export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateKey(): string {
  return formatDateKey(new Date());
}
