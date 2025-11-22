import { NextResponse } from 'next/server';
import type { Group, GroupMember } from '@/types';

export async function GET() {
  try {
    const sheetUrl = process.env.GOOGLE_SHEET_CSV_URL;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: 'Google Sheet URL not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(sheetUrl, {
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: ${response.statusText}`);
    }

    const csvText = await response.text();
    const groups = parseCSV(csvText);

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups from Google Sheets' },
      { status: 500 }
    );
  }
}

function parseCSV(csvText: string): Group[] {
  const lines = csvText.trim().split('\n');
  const groupMap = new Map<number, GroupMember[]>();

  // Skip header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted values)
    const values = parseCSVLine(line);

    if (values.length >= 4) {
      const groupNumber = parseInt(values[0], 10);
      const member: GroupMember = {
        name: values[1],
        phone: formatPhoneNumber(values[2]),
        email: values[3],
      };

      // Add member to the group
      if (!groupMap.has(groupNumber)) {
        groupMap.set(groupNumber, []);
      }
      groupMap.get(groupNumber)!.push(member);
    }
  }

  // Convert map to array of groups
  const groups: Group[] = [];
  groupMap.forEach((members, groupNumber) => {
    groups.push({
      groupNumber,
      members,
      status: 'waiting',
    });
  });

  // Sort by group number
  groups.sort((a, b) => a.groupNumber - b.groupNumber);

  return groups;
}

function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's a 10-digit US number, add +1 prefix
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1, add + prefix
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it already has +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Otherwise, assume it needs +1
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
