// emailOutboundsImportBootstrap.js
// ╔══════════════════════════════════════════════════════════════════╗
// ║ emailOutboundsImportBootstrap.js — Bootstrap Import Outbounds   ║
// ║ CONSART ERP — Sync "Sent" folder (Hostinger IMAP → emailOutbounds) ║
// ╚══════════════════════════════════════════════════════════════════╝

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runImportOutboundsFromHostingerJob } from './controllers/emailOutboundsController.js';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env explicitly from backend folder
dotenv.config({ path: path.join(__dirname, '.env') });

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runOnce() {
  console.log('[OutboundsImportBootstrap] Starting Hostinger "Sent" import job...');
  console.log(
    '[OutboundsImportBootstrap] DEBUG ROCHIN_AIR_EMAIL_USER =',
    process.env.ROCHIN_AIR_EMAIL_USER,
  );

  try {
    const importedCount = await runImportOutboundsFromHostingerJob();
    console.log(
      `[OutboundsImportBootstrap] Job finished. Imported ${importedCount} e-mail(s).`,
    );
  } catch (err) {
    console.error(
      '[OutboundsImportBootstrap] Error while running import job:',
      err,
    );
  }
}

async function bootstrap() {
  console.log(
    `[OutboundsImportBootstrap] Worker started. Interval = ${INTERVAL_MS} ms`,
  );

  // Run immediately at startup
  await runOnce();

  // Schedule periodic sync
  setInterval(() => {
    runOnce().catch((err) => {
      console.error(
        '[OutboundsImportBootstrap] Unhandled error in scheduled run:',
        err,
      );
    });
  }, INTERVAL_MS);
}

bootstrap().catch((err) => {
  console.error(
    '[OutboundsImportBootstrap] Fatal error starting worker:',
    err,
  );
  process.exitCode = 1;
});
