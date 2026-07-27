import { describe, it, expect } from 'vitest';
import { toICS, googleCalendarUrl } from '@/lib/ics';
import type { EventDTO } from '@/types';

const event: EventDTO = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  title: 'Rooftop Party',
  description: 'Bring a friend',
  date: '2030-06-01',
  startTime: '18:00',
  endTime: '20:00',
  location: 'Skyline Terrace',
  latitude: null,
  longitude: null,
  coverImage: null,
  capacity: null,
  slug: 'rooftop-party',
  visibility: 'PUBLIC',
  attendanceMode: 'NONE',
  minPafAmount: null,
  ticketPrice: null,
  reminderLeadMinutes: 120,
  creatorId: '11111111-1111-1111-1111-111111111111',
  createdAt: '2030-01-01T00:00:00.000Z',
  counts: { going: 1, maybe: 0, notGoing: 0, waitlist: 0, total: 1 },
};

describe('calendar export', () => {
  it('produces a valid VCALENDAR/VEVENT', () => {
    const ics = toICS(event);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('SUMMARY:Rooftop Party');
    expect(ics).toContain('DTSTART');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('builds a Google Calendar URL', () => {
    const url = googleCalendarUrl(event);
    expect(url).toContain('calendar.google.com');
    expect(url).toContain('Rooftop+Party');
  });
});
