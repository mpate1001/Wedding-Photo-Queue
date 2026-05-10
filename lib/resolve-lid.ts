import type { Client } from 'whatsapp-web.js';

/**
 * Resolves a phone to a WhatsApp WID and forces both contact-side AND
 * group-side LID metadata sync that addParticipants requires.
 *
 * Runs three phases:
 *   1. Standard methods (fetchMessages, getProfilePicUrl) — contact metadata
 *   2. pupPage.evaluate calling WhatsApp's internal Store APIs
 *      (QueryExist, Contact.find, GroupMetadata.find) — group-side LID map
 *   3. 1s settle delay so the LID propagates before addParticipants
 *
 * Returns null if the number is not on WhatsApp.
 *
 * Phase 2 reaches into WhatsApp Web internals which change over time. Each
 * call is try-wrapped and the result is logged so silent breakage can be
 * diagnosed from pm2 logs.
 */
export async function resolveLidForAdd(
  client: Client,
  groupId: string,
  rawPhone: string
): Promise<string | null> {
  const numberId = await client.getNumberId(rawPhone);
  if (!numberId) return null;
  const resolvedId = numberId._serialized;

  // Phase 1: contact-side metadata via documented APIs
  try {
    const chat = await client.getChatById(resolvedId);
    await chat.fetchMessages({ limit: 1 });
  } catch (e) {
    console.warn(`[resolve-lid] phase1 fetchMessages failed for ${resolvedId}:`, e);
  }
  try {
    await client.getProfilePicUrl(resolvedId);
  } catch {
    // privacy-blocked profile throws — metadata side effect already happened
  }

  // Phase 2: force WhatsApp internal LID resolution via pupPage.evaluate
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = (client as any).pupPage;
    if (!page) {
      console.warn('[resolve-lid] phase2 pupPage unavailable');
    } else {
      const result = await page.evaluate(
        async (gId: string, cId: string) => {
          const out: Record<string, unknown> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Store = (window as any).Store;
          if (!Store) return { error: 'Store not exposed on window' };

          try {
            const groupWid = Store.WidFactory?.createWid?.(gId);
            const contactWid = Store.WidFactory?.createWid?.(cId);

            if (Store.QueryExist?.queryWidExists && contactWid) {
              try {
                await Store.QueryExist.queryWidExists(contactWid);
                out.queryExist = 'ok';
              } catch (e) {
                out.queryExist = `err: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            if (Store.Contact?.find && contactWid) {
              try {
                await Store.Contact.find(contactWid);
                out.contactFind = 'ok';
              } catch (e) {
                out.contactFind = `err: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            if (Store.GroupMetadata?.find && groupWid) {
              try {
                await Store.GroupMetadata.find(groupWid);
                out.groupMetaFind = 'ok';
              } catch (e) {
                out.groupMetaFind = `err: ${e instanceof Error ? e.message : String(e)}`;
              }
            }

            return out;
          } catch (e) {
            return { fatalError: e instanceof Error ? e.message : String(e) };
          }
        },
        groupId,
        resolvedId
      );
      console.log(
        `[resolve-lid] phase2 internal-Store for ${resolvedId} in ${groupId}:`,
        result
      );
    }
  } catch (e) {
    console.warn(`[resolve-lid] phase2 pupPage.evaluate threw for ${resolvedId}:`, e);
  }

  // Phase 3: settle delay so the LID propagates before addParticipants
  await new Promise((r) => setTimeout(r, 1000));

  return resolvedId;
}
