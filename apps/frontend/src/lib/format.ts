// Display formatting helpers shared across views/components.

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDayMonth(iso: string): { day: string; month: string; weekday: string } {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(undefined, { day: 'numeric' }).format(d),
    month: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(d),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d),
  };
}

export function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime) return '';
  return endTime ? `${startTime} – ${endTime}` : startTime;
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return formatDate(iso);
}

export function timeOfDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** avatar is a color token when it starts with '#', otherwise it's an image URL. */
export function isColorAvatar(avatar: string): boolean {
  return avatar.startsWith('#');
}
