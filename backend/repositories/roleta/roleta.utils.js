// ╔════════════════════════════════════════════════════════════════════╗
// ║ roleta.utils.js — generateToken                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import crypto from 'crypto';

export function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}
