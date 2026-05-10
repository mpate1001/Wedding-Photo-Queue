import type { Client } from 'whatsapp-web.js';

/**
 * Resolves a raw phone number to a WhatsApp _serialized WID and forces the
 * LID metadata sync that addParticipants requires. Returns null if the number
 * is not registered on WhatsApp.
 *
 * Why: getChatById() alone returns a Chat instance without triggering the
 * chat-table populate that holds the LID. fetchMessages and getProfilePicUrl
 * both have the side effect of forcing that sync — running both as
 * belt-and-suspenders covers contacts who block one or the other.
 */
export async function resolveLidForAdd(
  client: Client,
  rawPhone: string
): Promise<string | null> {
  const numberId = await client.getNumberId(rawPhone);
  if (!numberId) return null;
  const resolvedId = numberId._serialized;

  try {
    const chat = await client.getChatById(resolvedId);
    await chat.fetchMessages({ limit: 1 });
  } catch (e) {
    console.warn(`[resolve-lid] fetchMessages failed for ${resolvedId}:`, e);
  }

  try {
    await client.getProfilePicUrl(resolvedId);
  } catch {
    // Profile pic privacy-blocked contacts throw — but the side effect of
    // contact metadata fetch already populated LID. Silently ignore.
  }

  return resolvedId;
}
