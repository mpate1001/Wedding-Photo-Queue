import { normalizePhone, phonesMatch } from './phone-match';

export interface SheetGuest {
  name: string;
  phone: string;
  email: string;
}

export interface GroupParticipant {
  phone: string;  // raw from whatsapp-web.js, like "+12566584291"
}

export type GuestStatus = 'joined' | 'missing' | 'no-whatsapp';

export interface DiffedGuest {
  guest: SheetGuest;
  status: GuestStatus;
}

/**
 * Diff a guest list from Google Sheets against a WhatsApp group participant list.
 * Deduplicates guests by normalized phone — same phone listed twice counted once.
 *
 * Returns one DiffedGuest per unique guest, preserving the first occurrence's
 * data (name/email) from the sheet.
 */
export function diffGuestsAgainstParticipants(
  guests: SheetGuest[],
  participants: GroupParticipant[]
): DiffedGuest[] {
  // Deduplicate guests by normalized phone. Malformed phones get their own slot
  // using the raw phone value as the key (so multiple malformed rows each appear).
  const seen = new Map<string, SheetGuest>();
  for (const g of guests) {
    const normalized = normalizePhone(g.phone);
    const key = normalized ?? `__malformed__${g.phone}_${g.name}`;
    if (!seen.has(key)) {
      seen.set(key, g);
    }
  }

  return Array.from(seen.values()).map((guest) => {
    const normalized = normalizePhone(guest.phone);
    if (normalized === null) {
      return { guest, status: 'no-whatsapp' as const };
    }

    const inGroup = participants.some((p) => phonesMatch(p.phone, guest.phone));
    return { guest, status: inGroup ? 'joined' : 'missing' };
  });
}
