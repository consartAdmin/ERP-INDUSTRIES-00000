// ╔══════════════════════════════════════════════════════════════════╗
// ║ emailListenerBootstrap.js — Bootstrap IMAP Inbounds (Hostinger) ║
// ║ CONSART ERP — Rochin Air (incoming emails)                      ║
// ╚══════════════════════════════════════════════════════════════════╝

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { startRochinAirEmailListener } from './controllers/emailInboundsController.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Load .env from backend folder explicitly
dotenv.config({ path: path.join(__dirname, '.env') });

async function bootstrap() {
  try {
    console.log('[Bootstrap Inbounds] Starting Rochin Air IMAP listener...');
    console.log(
      '[Bootstrap Inbounds] DEBUG ROCHIN_AIR_EMAIL_USER =',
      process.env.ROCHIN_AIR_EMAIL_USER,
    );

    await startRochinAirEmailListener();

    console.log(
      '[Bootstrap Inbounds] Listener finished (normally only on shutdown).',
    );
  } catch (err) {
    console.error(
      '[Bootstrap Inbounds] Fatal error while starting IMAP listener:',
      err,
    );
    process.exitCode = 1;
  }
}

bootstrap();
