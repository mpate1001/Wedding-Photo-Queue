// lib/whatsapp-session.ts
import { Client, LocalAuth } from 'whatsapp-web.js';

// Extend globalThis to prevent re-initialization across Next.js hot reloads
declare global {
  // eslint-disable-next-line no-var
  var __whatsappClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __whatsappStatus: 'initializing' | 'qr_pending' | 'ready' | 'auth_failure' | 'disconnected';
  // eslint-disable-next-line no-var
  var __whatsappQR: string | undefined;
}

function initClient(): Client {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  global.__whatsappStatus = 'initializing';
  global.__whatsappQR = undefined;

  client.on('qr', (qr) => {
    global.__whatsappStatus = 'qr_pending';
    global.__whatsappQR = qr;
    console.log('[WhatsApp] QR code ready — visit /api/whatsapp-status to view');
  });

  client.on('ready', () => {
    global.__whatsappStatus = 'ready';
    global.__whatsappQR = undefined;
    console.log('[WhatsApp] Client ready');
  });

  client.on('auth_failure', (msg) => {
    global.__whatsappStatus = 'auth_failure';
    console.error('[WhatsApp] Auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    global.__whatsappStatus = 'disconnected';
    console.warn('[WhatsApp] Disconnected:', reason);
  });

  client.initialize().catch((err) => {
    console.error('[WhatsApp] Initialization error:', err);
  });

  return client;
}

export function getWhatsAppClient(): Client {
  if (!global.__whatsappClient) {
    global.__whatsappClient = initClient();
  }
  return global.__whatsappClient;
}

export function getWhatsAppStatus(): {
  status: typeof global.__whatsappStatus;
  qr?: string;
} {
  return {
    status: global.__whatsappStatus ?? 'initializing',
    qr: global.__whatsappQR,
  };
}
