// ╔══════════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfceClient.repository.js — Cliente axios NFC-e PlugNotas    ║
// ║ Efeito no load: avisa se PLUGNOTAS_API_KEY não estiver definida      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';

const PLUGNOTAS_BASE_URL =
  (process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br').replace(
    /\/$/,
    ''
  );
const PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY;

if (!PLUGNOTAS_API_KEY) {
  console.warn(
    '[plugnotasNfceApi] Atenção: PLUGNOTAS_API_KEY não está definida no ambiente.'
  );
}

export const http = axios.create({
  baseURL: PLUGNOTAS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': PLUGNOTAS_API_KEY, // maiúsculo, igual à documentação
  },
  timeout: 30000,
});
