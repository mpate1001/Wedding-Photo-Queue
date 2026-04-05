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
}

function initClient(): Client {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    || '/Users/mahekpatel/.cache/puppeteer/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  global.__whatsappStatus = 'initializing';
  global.__whatsappQR = undefined;

  client.on('qr', (qr) => {
    global.__whatsappStatus = 'qr_pending';
    global.__whatsappQR = qr;
    console.log('[WhatsApp] QR code ready — scan below with your phone:');
    qrcode.generate(qr, { small: true });
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

  console.log('[WhatsApp] Initializing with Chromium at:', executablePath);
  client.initialize().catch((err) => {
    console.error('[WhatsApp] Initialization error:', err);
    global.__whatsappStatus = 'disconnected';
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
