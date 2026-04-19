import { describe, it, expect } from 'vitest';
import { diffGuestsAgainstParticipants, type SheetGuest, type GroupParticipant } from './guest-diff';

const guestA: SheetGuest = { name: 'Alice', phone: '+12566584291', email: 'a@x.com' };
const guestB: SheetGuest = { name: 'Bob', phone: '(978) 319-3978', email: 'b@x.com' };
const guestC: SheetGuest = { name: 'Charlie', phone: '+447700900123', email: 'c@x.com' };
const guestMalformed: SheetGuest = { name: 'Malformed', phone: 'abc', email: 'd@x.com' };

describe('diffGuestsAgainstParticipants', () => {
  it('marks guest as joined when their phone matches a participant', () => {
    const participants: GroupParticipant[] = [{ phone: '+12566584291' }];
    const result = diffGuestsAgainstParticipants([guestA], participants);
    expect(result[0].status).toBe('joined');
    expect(result[0].guest).toBe(guestA);
  });

  it('marks guest as missing when phone does not match any participant but is parseable', () => {
    const participants: GroupParticipant[] = [{ phone: '+19999999999' }];
    const result = diffGuestsAgainstParticipants([guestA], participants);
    expect(result[0].status).toBe('missing');
  });

  it('marks guest as no-whatsapp when their phone is malformed', () => {
    const participants: GroupParticipant[] = [{ phone: '+12566584291' }];
    const result = diffGuestsAgainstParticipants([guestMalformed], participants);
    expect(result[0].status).toBe('no-whatsapp');
  });

  it('matches international numbers', () => {
    const participants: GroupParticipant[] = [{ phone: '+447700900123' }];
    const result = diffGuestsAgainstParticipants([guestC], participants);
    expect(result[0].status).toBe('joined');
  });

  it('handles mix of guest statuses', () => {
    const participants: GroupParticipant[] = [
      { phone: '+12566584291' },
      { phone: '+19999999999' },
    ];
    const result = diffGuestsAgainstParticipants(
      [guestA, guestB, guestC, guestMalformed],
      participants
    );
    expect(result).toHaveLength(4);
    expect(result[0].status).toBe('joined');
    expect(result[1].status).toBe('missing');
    expect(result[2].status).toBe('missing');
    expect(result[3].status).toBe('no-whatsapp');
  });

  it('deduplicates by phone — same guest listed twice counted once', () => {
    const dupe = { ...guestA };
    const participants: GroupParticipant[] = [{ phone: '+12566584291' }];
    const result = diffGuestsAgainstParticipants([guestA, dupe], participants);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('joined');
  });

  it('returns empty array for empty guest list', () => {
    expect(diffGuestsAgainstParticipants([], [])).toEqual([]);
  });
});
