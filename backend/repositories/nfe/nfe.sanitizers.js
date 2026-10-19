// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfe.sanitizers.js — Sanitização / datas / moeda                      ║
// ║ ✔ CPF/CNPJ, telefone, CEP, logradouro                                ║
// ║ ✔ Parse/format de datas e valores BR                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  round2,
  onlyDigits,
} from './nfe.utils.js';

export function formatLocalISODate(date) {
  const d = parseDateOrNull(date);
  if (!d) return null;

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

/* =========================================================================
 * 🧩 Sanitização / utilitários
 * ========================================================================= */
export function sanitizeCpfCnpj(value) {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits || null;
}

export function splitPhone(value) {
  if (!value) return undefined;
  const digits = String(value).replace(/\D/g, '');
  if (digits.length < 10) return undefined;
  const ddd = digits.slice(0, 2);
  const numero = digits.slice(2);
  return { ddd, numero };
}

export function sanitizeCep(value) {
  const d = onlyDigits(value);
  return d || null;
}

export function normalizeUpperText(value) {
  return String(value || '').trim().toUpperCase();
}

export function montarLogradouroNfe(tipoLogradouro, nomeLogradouro) {
  const tipo = normalizeUpperText(tipoLogradouro);
  const nome = normalizeUpperText(nomeLogradouro);

  if (!tipo && !nome) return '';
  if (!tipo) return nome;
  if (!nome) return tipo;

  if (nome.startsWith(`${tipo} `)) {
    return nome;
  }

  return `${tipo} ${nome}`.trim();
}

export function isValidDateObj(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function parseDateOrNull(value) {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return isValidDateObj(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);
    return isValidDateObj(d) ? d : null;
  }

  m = raw.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (m) {
    const [, dd, mm, yyyy, hh = '12', mi = '00', ss = '00'] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return isValidDateObj(d) ? d : null;
  }

  m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), 12, 0, 0);
    return isValidDateObj(d) ? d : null;
  }

  m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (m) {
    const [, yyyy, mm, dd, hh = '12', mi = '00', ss = '00'] = m;
    const d = new Date(
      Number(yyyy),
      Number(mm) - 1,
      Number(dd),
      Number(hh),
      Number(mi),
      Number(ss)
    );
    return isValidDateObj(d) ? d : null;
  }

  const d = new Date(raw);
  return isValidDateObj(d) ? d : null;
}

export function addDays(date, days) {
  const base = parseDateOrNull(date);
  if (!base) return null;

  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    12,
    0,
    0
  );

  d.setDate(d.getDate() + Number(days || 0));

  return isValidDateObj(d) ? d : null;
}

export function nowSaoPauloISODate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export function formatDateBR(value) {
  const d = parseDateOrNull(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatMoneyBR(value) {
  return `R$ ${round2(value).toFixed(2).replace('.', ',')}`;
}

export function formatMoneyBRComplete(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
