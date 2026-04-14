// lib/sheets.ts
// Shared Google Sheets CSV fetch + parse logic.
// Called directly by server-side routes to avoid internal HTTP round-trips
// (which break on VPS due to nginx SSL termination mismatches).

import type { Group, GroupMember } from '@/types';

export async function fetchGroupsFromSheet(): Promise<Group[]> {
  const sheetUrl = process.env.GOOGLE_SHEET_CSV_URL;
  if (!sheetUrl) {
    throw new Error('GOOGLE_SHEET_CSV_URL not configured');
  }

  const response = await fetch(sheetUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet: ${response.statusText}`);
  }

  const csvText = await response.text();
  return parseCSV(csvText);
}

/**
 * Fetches the final wedding guest list (separate sheet from the photo queue).
 * Columns: PK | First Name | Last Name | Side | Relationship | Wedding | Email | Phone | Address
 * Filters to only guests with Wedding = "Attending".
 */
export async function fetchFinalGuestList(): Promise<GroupMember[]> {
  const sheetUrl = process.env.FINAL_GUEST_LIST;
  if (!sheetUrl) {
    throw new Error('FINAL_GUEST_LIST not configured');
  }

  const response = await fetch(sheetUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch guest list: ${response.statusText}`);
  }

  const csvText = await response.text();
  return parseGuestListCSV(csvText);
}

function parseGuestListCSV(csvText: string): GroupMember[] {
  const lines = csvText.trim().split('\n');
  const guests: GroupMember[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length < 8) continue;

    // Column indices: 0=PK, 1=First, 2=Last, 3=Side, 4=Relationship, 5=Wedding, 6=Email, 7=Phone, 8=Address
    const firstName = values[1];
    const lastName = values[2];
    const weddingStatus = values[5];
    const email = values[6];
    const phone = values[7];

    // Only include attending guests
    if (weddingStatus.toLowerCase() !== 'attending') continue;

    // Need at least a name to be useful
    const name = `${firstName} ${lastName}`.trim();
    if (!name) continue;

    guests.push({
      name,
      phone: phone ? formatPhoneNumber(phone) : '',
      email: email || '',
    });
  }

  return guests;
}

function parseCSV(csvText: string): Group[] {
  const lines = csvText.trim().split('\n');
  const groupMap = new Map<number, GroupMember[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length >= 4) {
      const groupNumber = parseInt(values[0], 10);
      const member: GroupMember = {
        name: values[1],
        phone: formatPhoneNumber(values[2]),
        email: values[3],
      };

      if (!groupMap.has(groupNumber)) {
        groupMap.set(groupNumber, []);
      }
      groupMap.get(groupNumber)!.push(member);
    }
  }

  const groups: Group[] = [];
  groupMap.forEach((members, groupNumber) => {
    groups.push({ groupNumber, members, status: 'waiting' });
  });
  groups.sort((a, b) => a.groupNumber - b.groupNumber);
  return groups;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+1${digits}`;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
