// lib/whatsapp-session.ts
import { Client, LocalAuth } from 'whatsapp-web.js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('qrcode-terminal');

// Extend globalThis to prevent re-initialization across Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __whatsappClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __whatsappStatus: 'initializing' | 'qr_pending' | 'ready' | 'auth_failure' | 'disconnected';
  // eslint-disable-next-line no-var
  var __whatsappQR: string | undefined;
  // eslint-disable-next-line no-var
  var __whatsappInitPromise: Promise<Client> | undefined;
}

function initClient(): Promise<Client> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!executablePath) {
    throw new Error(
      '[WhatsApp] PUPPETEER_EXECUTABLE_PATH is not set. ' +
      'On the VPS, set it to /usr/bin/google-chrome-stable (or the correct Chromium path).'
    );
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  global.__whatsappClient = client;
  global.__whatsappStatus = 'initializing';
  global.__whatsappQR = undefined;

  const readyPromise = new Promise<Client>((resolve, reject) => {
    client.on('ready', () => {
      global.__whatsappStatus = 'ready';
      global.__whatsappQR = undefined;
      console.log('[WhatsApp] Client ready');
      resolve(client);
    });

    client.on('auth_failure', (msg) => {
      global.__whatsappStatus = 'auth_failure';
      global.__whatsappInitPromise = undefined;
      console.error('[WhatsApp] Auth failure:', msg);
      reject(new Error(`WhatsApp auth failure: ${msg}`));
    });
  });

  client.on('qr', (qr) => {
    global.__whatsappStatus = 'qr_pending';
    global.__whatsappQR = qr;
    console.log('[WhatsApp] QR code ready — scan below with your phone:');
    qrcode.generate(qr, { small: true });
  });

  client.on('disconnected', (reason) => {
    global.__whatsappStatus = 'disconnected';
    global.__whatsappInitPromise = undefined;
    console.warn('[WhatsApp] Disconnected:', reason);
  });

  console.log('[WhatsApp] Initializing with Chromium at:', executablePath);
  client.initialize().catch((err) => {
    console.error('[WhatsApp] Initialization error:', err);
    global.__whatsappStatus = 'disconnected';
    global.__whatsappInitPromise = undefined;
  });

  return readyPromise;
}

/**
 * Returns a Promise that resolves to the ready WhatsApp client.
 * All concurrent callers share the same init promise — no duplicate Puppeteer spawns.
 * Throws if initialization fails.
 */
export function whenReady(): Promise<Client> {
  if (!global.__whatsappInitPromise) {
    global.__whatsappInitPromise = initClient();
  }
  return global.__whatsappInitPromise;
}

/** @deprecated Use whenReady() instead. Kept for backward compatibility. */
export function getWhatsAppClient(): Client {
  // Trigger init if not already started
  if (!global.__whatsappInitPromise) {
    global.__whatsappInitPromise = initClient();
  }
  if (!global.__whatsappClient) {
    throw new Error('[WhatsApp] Client not yet initialized — use whenReady() for async access');
  }
  return global.__whatsappClient;
}

export function getWhatsAppStatus(): {
  status: typeof global.__whatsappStatus;
  qr?: string;
} {
  // If we have a client and the status variable was lost (hot reload), check actual client state
  if (global.__whatsappClient && (!global.__whatsappStatus || global.__whatsappStatus === 'initializing')) {
    const info = global.__whatsappClient.info;
    if (info && info.wid) {
      global.__whatsappStatus = 'ready';
    }
  }

  return {
    status: global.__whatsappStatus ?? 'initializing',
    qr: global.__whatsappQR,
  };
}
