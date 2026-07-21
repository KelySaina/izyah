import { createEventSchema } from '../src/modules/events/event.schemas';
import { createUserSchema } from '../src/modules/users/user.schemas';
import { rsvpSchema } from '../src/modules/participants/participant.schemas';

// Pure validation tests — no infrastructure required.
describe('event schema', () => {
  it('accepts a valid event and coerces the date', () => {
    const parsed = createEventSchema.parse({
      title: '  Birthday   party ',
      date: '2030-01-01T18:00:00.000Z',
      startTime: '18:00',
    });
    expect(parsed.title).toBe('Birthday party'); // whitespace collapsed
    expect(parsed.date).toBeInstanceOf(Date);
  });

  it('rejects an empty title', () => {
    expect(() => createEventSchema.parse({ title: '   ', date: '2030-01-01' })).toThrow();
  });

  it('rejects a malformed time', () => {
    expect(() =>
      createEventSchema.parse({ title: 'x', date: '2030-01-01', startTime: '25:99' }),
    ).toThrow();
  });
});

describe('user schema', () => {
  it('accepts a hex avatar color', () => {
    expect(createUserSchema.parse({ avatar: '#AABBCC' }).avatar).toBe('#AABBCC');
  });
  it('rejects a non-color, non-url avatar', () => {
    expect(() => createUserSchema.parse({ avatar: 'purple' })).toThrow();
  });
});

describe('rsvp schema', () => {
  it('only allows known statuses', () => {
    expect(rsvpSchema.parse({ status: 'GOING' }).status).toBe('GOING');
    expect(() => rsvpSchema.parse({ status: 'PERHAPS' })).toThrow();
  });
});
