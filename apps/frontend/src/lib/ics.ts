import type { EventDTO } from '@/types';

// Calendar export: iCalendar (.ics) file + a Google Calendar quick-add URL.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Combine an event's date (ISO) with an optional "HH:MM" into a Date. */
function combine(dateIso: string, time: string | null): Date {
  const d = new Date(dateIso);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h ?? 0, m ?? 0, 0, 0);
  }
  return d;
}

function toICSDate(d: Date, allDay: boolean): string {
  if (allDay) return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  // UTC basic format.
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

function escapeText(text: string): string {
  return text.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

export function toICS(event: EventDTO): string {
  const allDay = !event.startTime;
  const start = combine(event.date, event.startTime);
  const end = event.endTime
    ? combine(event.date, event.endTime)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Izyah//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@izyah`,
    `SUMMARY:${escapeText(event.title)}`,
    allDay ? `DTSTART;VALUE=DATE:${toICSDate(start, true)}` : `DTSTART:${toICSDate(start, false)}`,
    allDay ? `DTEND;VALUE=DATE:${toICSDate(end, true)}` : `DTEND:${toICSDate(end, false)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : '',
    event.description ? `DESCRIPTION:${escapeText(event.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

export function downloadICS(event: EventDTO): void {
  const blob = new Blob([toICS(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.slug || 'event'}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(event: EventDTO): string {
  const allDay = !event.startTime;
  const start = combine(event.date, event.startTime);
  const end = event.endTime
    ? combine(event.date, event.endTime)
    : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const dates = `${toICSDate(start, allDay)}/${toICSDate(end, allDay)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: event.description ?? '',
    location: event.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
