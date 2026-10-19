// ╔══════════════════════════════════════════════════════════════════════════════════════╗
// ║ backend/services/danfeConsartService.js — Geração de DANFE a partir de XML           ║
// ║ CONSART ERP — Serviço puro (sem Express), retorna Buffer de PDF                      ║
// ╚══════════════════════════════════════════════════════════════════════════════════════╝

import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import xml2js from 'xml2js';
import util from 'node:util';
import { fileURLToPath } from 'node:url';
import pool from '../config/db.js';

// ESM: recria __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { processors } = xml2js;

const parser = new xml2js.Parser({
  explicitArray: false,
  tagNameProcessors: [processors.stripPrefix],
  attrNameProcessors: [processors.stripPrefix],
});
const parseStringPromise = util.promisify(parser.parseString);

function stampCanceladoOnTop(doc, cancelada) {
  if (!cancelada) return;

  doc.save();

  doc.rotate(-45, { origin: [297.5, 421] }); // centro A4
  doc
    .fontSize(90)
    .fillColor('red')
    .opacity(0.18)
    .text('CANCELADO', 0, 350, {
      align: 'center',
      width: 595,
    });

  doc.restore();
}

function normalizeSku(value = '') {
  return String(value ?? '').trim();
}

function normalizeUnit(value = '') {
  return String(value ?? '').trim();
}

function findOrderItemMatch(prodXml = {}, orderItems = [], itemIndex = -1) {
  const skuXml = normalizeSku(prodXml?.cProd);

  if (skuXml) {
    const bySku = orderItems.find((item) => normalizeSku(item?.sku) === skuXml);
    if (bySku) return bySku;
  }

  if (itemIndex >= 0 && orderItems[itemIndex]) {
    return orderItems[itemIndex];
  }

  return null;
}

function resolveDanfeUnit(prodXml = {}, orderItems = [], itemIndex = -1) {
  const orderItem = findOrderItemMatch(prodXml, orderItems, itemIndex);

  const unitFromOrder =
    orderItem?.unidadeComercial ??
    orderItem?.unidade_comercial ??
    orderItem?.unit_display ??
    orderItem?.unit ??
    orderItem?.unidade ??
    orderItem?.unidade_venda ??
    orderItem?.uom ??
    null;

  const unitFromXml =
    prodXml?.uCom ??
    prodXml?.uTrib ??
    null;

  const orderUnit = normalizeUnit(unitFromOrder);
  const xmlUnit = normalizeUnit(unitFromXml);

  // Prefer ERP unit when it is more specific than UN
  if (orderUnit && orderUnit !== 'UN') return orderUnit;

  // Then XML unit
  if (xmlUnit && xmlUnit !== 'UN') return xmlUnit;

  // If both are UN or empty
  return orderUnit || xmlUnit || 'UN';
}

// ======================================================================
// Helpers básicos
// ======================================================================
function removePaymentInfoFromInfCpl(infCpl = '') {
  const raw = String(infCpl || '').replace(/\r/g, '\n').trim();
  if (!raw) return '';

  return raw
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((parte) => {
      const upper = normalizeText(parte);

      return !(
        upper.includes('FORMA DE PAGAMENTO') ||
        upper.includes('DUPLICATA') ||
        upper.includes('PARCELA') ||
        upper.includes('VENC.:') ||
        upper.includes('VALOR: R$')
      );
    })
    .join(' | ')
    .trim();
}

function extractPaymentTextFromInfCpl(infCpl = '') {
  const raw = String(infCpl || '').replace(/\r/g, '\n').trim();
  if (!raw) return null;

  const upper = normalizeText(raw);

  const idxForma = upper.indexOf('FORMA DE PAGAMENTO');
  const idxDup = upper.indexOf('DUPLICATA');
  const idxParcela = upper.indexOf('PARCELA');

  const indices = [idxForma, idxDup, idxParcela].filter((n) => n >= 0);

  if (!indices.length) return null;

  const start = Math.min(...indices);
  return raw.slice(start).trim();
}

function hasExplicitPaymentInfo(infCpl = '') {
  const txt = normalizeText(infCpl || '');
  return (
    txt.includes('FORMA DE PAGAMENTO') ||
    txt.includes('DUPLICATA') ||
    txt.includes('PARCELA')
  );
}

const soNum = (s = '') => String(s).replace(/\D+/g, '');

function fmt(v, def = '—') {
  const s = (v ?? '').toString().trim();
  return s ? s : def;
}
function fmtCEP(cep = '') {
  const d = soNum(cep);
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return fmt(cep);
}

function sanitizeFileName(str = '') {
  return String(str)
    .normalize('NFD')                     // remove acentos
    .replace(/[\u0300-\u036f]/g, '')      // continua removendo acentos
    .replace(/[<>:"/\\|?*]+/g, ' ')       // remove caracteres proibidos em nomes de arquivo
    .replace(/\s+/g, ' ')                 // normaliza múltiplos espaços
    .trim();
}

async function loadActivePaymentMethods() {
  try {
    const { rows } = await pool.query(`
      SELECT
        "paymentMethods_id",
        name,
        type,
        installments,
        gap_one,
        gap_two,
        gap_three,
        gap_four,
        nfe_tpag,
        active
      FROM "paymentMethods"
      WHERE active = true
      ORDER BY "paymentMethods_id"
    `);

    return rows || [];
  } catch (err) {
    console.error('[DANFE] Erro ao carregar paymentMethods:', err);
    return [];
  }
}

function normalizeText(v = '') {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function parseDateOnly(raw) {
  if (!raw) return null;

  const base = String(raw).split('T')[0];
  const [y, m, d] = base.split('-').map(Number);

  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function daysBetween(startDate, endDate) {
  if (!(startDate instanceof Date) || !(endDate instanceof Date)) return 0;

  const a = new Date(startDate);
  const b = new Date(endDate);

  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);

  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function extractDuplicateGaps(duplicatas = [], emissaoBase = null) {
  if (!Array.isArray(duplicatas) || !duplicatas.length || !emissaoBase) {
    return [];
  }

  const dtBase = parseDateOnly(emissaoBase);
  if (!dtBase) return [];

  return duplicatas
    .map((dup) => {
      const dtVenc = parseDateOnly(dup?.vencimento || dup?.dVenc);
      return daysBetween(dtBase, dtVenc);
    })
    .filter((n) => Number.isFinite(n) && n >= 0);
}

const NFE_PAYMENT_METHODS = Object.freeze({
  '01': 'DINHEIRO',
  '03': 'CARTÃO DE CRÉDITO',
  '04': 'CARTÃO DE DÉBITO',
  '15': 'BOLETO BANCÁRIO',
  '16': 'DEPÓSITO BANCÁRIO',
  '17': 'PIX',
  '18': 'TRANSFERÊNCIA BANCÁRIA',
  '90': 'SEM PAGAMENTO',
  '99': 'OUTROS',
});

function resolvePaymentMethodName(detPag = {}) {
  const tPag = String(detPag.tPag ?? '').trim().padStart(2, '0');

  return NFE_PAYMENT_METHODS[tPag] || `TPAG ${tPag}`;
}

// ======================================================================
// ✅ Detecta se a NF-e está CANCELADA (robusto: DB/prot, cStat, evento 110111)
// ======================================================================
function isNfeCancelada({ prot, infProt, parsed }) {
  try {
    // 1) prioridade: status vindo do seu DB/bridge
    const s = String(prot?.status || prot?.nfe_status || '').toLowerCase();
    if (s.includes('cancel')) return true;

    // 2) protocolo de autorização com motivo/cStat de cancelamento
    const cStat = String(infProt?.cStat || '').trim();
    const xMotivo = String(infProt?.xMotivo || '').toLowerCase();
    if (cStat === '101') return true; // cancelamento homologado
    if (xMotivo.includes('cancel')) return true;

    // 3) evento de cancelamento dentro do XML: tpEvento 110111
    // procEventoNFe pode aparecer como array ou objeto (xml2js explicitArray:false)
    const procEvt = findByKey(parsed || {}, 'procEventoNFe');
    const toArr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
    const evts = toArr(procEvt);

    for (const pe of evts) {
      const evt = findByKey(pe, 'evento') || pe?.evento;
      const infEvt = findByKey(evt, 'infEvento') || evt?.infEvento;
      const tp = String(infEvt?.tpEvento || '').trim();
      if (tp === '110111') return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ======================================================================
// ✅ Marca d’água "CANCELADO" em TODA a página (modelo Image 1)
// ======================================================================
function aplicarMarcaDAguaCancelado(doc) {
  try {
    const W = doc.page.width;
    const H = doc.page.height;

    doc.save();

    // opacidade leve, mas visível
    doc.opacity(0.22);

    // vermelho padrão DANFE
    doc.fillColor('#D40000');

    // rotaciona no centro da página
    const cx = W / 2;
    const cy = H / 2;

    doc.rotate(-28, { origin: [cx, cy] });

    // texto grande central
    doc.font('Helvetica-Bold').fontSize(110);

    // largura grande pra centralizar
    const boxW = W * 1.2;

    doc.text('CANCELADO', cx - boxW / 2, cy - 70, {
      width: boxW,
      align: 'center',
      lineBreak: false,
    });

    doc.restore();
  } catch (e) {
    console.error('[DANFE] Erro ao aplicar marca d’água CANCELADO:', e);
  }
}

// ======================================================================
// Marca d’água para pré-visualização sem valor fiscal
// ======================================================================
function aplicarMarcaDAguaSemValorFiscal(doc, { fontSize = 62, offsetY = 0 } = {}) {
  try {
    const width = doc.page.width;
    const height = doc.page.height;

    doc.save();

    doc.opacity(0.16);
    doc.fillColor('#D40000');

    const centerX = width / 2;
    const centerY = height / 2;

    doc.rotate(
      -28,
      {
        origin: [
          centerX,
          centerY,
        ],
      }
    );

    doc
      .font('Helvetica-Bold')
      .fontSize(fontSize);

    const boxWidth =
      width * 1.35;

    doc.text(
      'SEM VALOR FISCAL',
      centerX - boxWidth / 2,
      centerY - 50 + offsetY,
      {
        width: boxWidth,
        align: 'center',
        lineBreak: false,
      }
    );

    doc.restore();

    doc
      .opacity(1)
      .fillColor('#000000');
  } catch (error) {
    console.error(
      '[DANFE] Erro ao aplicar SEM VALOR FISCAL:',
      error
    );
  }
}



// ======================================================================
// Busca recursiva / caminhos dentro do XML
// ======================================================================
function findByKey(obj, keyWanted) {
  if (!obj || typeof obj !== 'object') return null;
  const keys = Object.keys(obj);
  for (const k of keys) {
    if (k.toLowerCase() === keyWanted.toLowerCase()) return obj[k];
  }
  for (const k of keys) {
    const child = obj[k];
    if (child && typeof child === 'object') {
      const hit = findByKey(child, keyWanted);
      if (hit) return hit;
    }
  }
  return null;
}

/** Localiza NFe/infNFe com e sem wrapper nfeProc/procNFe */
function getInfNFe(parsed) {
  const nfeProc =
    findByKey(parsed, 'nfeProc') ||
    findByKey(parsed, 'procNFe') ||
    null;

  const NFe =
    (nfeProc && findByKey(nfeProc, 'NFe')) ||
    findByKey(parsed, 'NFe') ||
    null;

  const infNFe =
    (NFe && findByKey(NFe, 'infNFe')) ||
    findByKey(parsed, 'infNFe') ||
    null;

  return { nfeProc, NFe, infNFe };
}

/** Localiza protocolo (protNFe/infProt) em qualquer nível */
function getProt(container) {
  const protNFe = findByKey(container || {}, 'protNFe');
  const infProt =
    (protNFe && findByKey(protNFe, 'infProt')) ||
    findByKey(container || {}, 'infProt') ||
    null;
  return { protNFe, infProt };
}



/**
 * Se precisar, ainda consigo localizar XML em disco por chave/nome.
 * (Mantive para compatibilidade; pode ignorar se for sempre usar xmlContent.)
 */
export function localizarXMLPorChaveOuNome({ chave, xmlFile }) {
  const raw = String(xmlFile || chave || '').trim();
  const digits = soNum(raw);
  const baseName = raw.toLowerCase().endsWith('.xml')
    ? raw
    : (digits.length ? digits : raw);

  const bases = [
    path.join(process.cwd(), 'backend/public/painelNotasFiscais/xml'),
    path.join(process.cwd(), 'backend/public/xml'),
    path.join(process.cwd(), 'public/painelNotasFiscais/xml'),
    path.join(process.cwd(), 'public/xml'),
  ];

  const candidates = new Set([
    baseName,
    `${baseName}.xml`,
    `${digits}.xml`,
    `NFe${digits}.xml`,
    `nfe-${digits}.xml`,
    `procNFe_${digits}.xml`,
    `procNFe-${digits}.xml`,
    `procNFe${digits}.xml`,
  ]);

  const tentativas = [];

  for (const base of bases) {
    for (const cand of candidates) {
      const filename = cand.toLowerCase().endsWith('.xml') ? cand : `${cand}.xml`;
      const full = path.resolve(base, filename);
      tentativas.push(full);
      if (fs.existsSync(full)) {
        console.log('✅ localizarXMLPorChaveOuNome: encontrado em', full);
        return { caminho: full, tentativas, meta: { raw, digits, baseName } };
      }
    }

    try {
      const files = fs.readdirSync(base);
      const found = files.find(f =>
        f.toLowerCase().endsWith('.xml') &&
        (digits ? f.includes(digits) : f.toLowerCase() === baseName.toLowerCase())
      );
      if (found) {
        const full = path.resolve(base, found);
        console.log('✅ localizarXMLPorChaveOuNome: varredura →', full);
        return { caminho: full, tentativas, meta: { raw, digits, baseName } };
      }
    } catch {
      // diretório pode não existir
    }
  }

  console.error('❌ localizarXMLPorChaveOuNome: XML NÃO ENCONTRADO.', {
    raw, digits, baseName, tentativas,
  });

  return { caminho: null, tentativas, meta: { raw, digits, baseName } };
}

/** Extrai chave de 44 dígitos de vários lugares (infNFe.Id, prot, nome arquivo, parâmetro) */
function extrairChave44({ parsed, xmlPath, paramChave }) {
  const { nfeProc, NFe, infNFe } = getInfNFe(parsed || {});
  const { infProt } = getProt(nfeProc || parsed || {});
  const fontes = [];

  const idAttr = infNFe?.$?.Id || NFe?.infNFe?.$?.Id || '';
  const idDigits = soNum(String(idAttr).replace(/^NFe/i, ''));
  if (/^\d{44}$/.test(idDigits)) {
    fontes.push({ origem: 'infNFe.$.Id', valor: idDigits });
  }

  const chProt = soNum(infProt?.chNFe || '');
  if (/^\d{44}$/.test(chProt)) {
    fontes.push({ origem: 'protNFe.infProt.chNFe', valor: chProt });
  }

  const fileDigits = soNum(path.basename(xmlPath || ''));
  if (/^\d{44}$/.test(fileDigits)) {
    fontes.push({ origem: 'nome_arquivo', valor: fileDigits });
  }

  const paramDigits = soNum(paramChave || '');
  if (/^\d{44}$/.test(paramDigits)) {
    fontes.push({ origem: 'parametro', valor: paramDigits });
  }

  const preferencia = [
    'infNFe.$.Id',
    'protNFe.infProt.chNFe',
    'nome_arquivo',
    'parametro',
  ];
  const escolhido = fontes.sort(
    (a, b) => preferencia.indexOf(a.origem) - preferencia.indexOf(b.origem),
  )[0];

  if (escolhido) {
    console.log(
      `[DANFE] Chave de acesso obtida de ${escolhido.origem}: ${escolhido.valor}`,
    );
    return escolhido.valor;
  }

  return '';
}

/** Calcula chave 44 a partir de ide/emit (caso não venha pronta) */
function calcularChave44DeInfNFe(infNFe) {
  try {
    const soNum = (s = '') => String(s).replace(/\D+/g, '');
    const ide = infNFe?.ide || {};
    const emit = infNFe?.emit || {};

    const cUF = soNum(ide.cUF).padStart(2, '0');
    const dhEmi = String(ide.dhEmi || ide.dEmi || '');
    const AAMM = dhEmi
      ? dhEmi.slice(2, 4) + dhEmi.slice(5, 7)
      : '0000';
    const CNPJ = soNum(emit.CNPJ).padStart(14, '0');
    const mod = soNum(ide.mod || '55').padStart(2, '0');
    const serie = soNum(ide.serie).padStart(3, '0');
    const nNF = soNum(ide.nNF).padStart(9, '0');
    const tpEmis = soNum(ide.tpEmis || '1').padStart(1, '0');
    const cNF = soNum(ide.cNF).padStart(8, '0');

    const base43 = cUF + AAMM + CNPJ + mod + serie + nNF + tpEmis + cNF;
    if (base43.length !== 43 || /[^0-9]/.test(base43)) return '';

    let peso = 2;
    let soma = 0;
    for (let i = base43.length - 1; i >= 0; i--) {
      soma += Number(base43[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    let dv = 11 - (soma % 11);
    if (dv >= 10) dv = 0;

    return base43 + String(dv);
  } catch {
    return '';
  }
}

// ======================================================================
// Marca d'água específica para o BLOCO DE PRODUTOS
// ======================================================================
function aplicarMarcaDAguaProdutos(doc, { x, y, w, h }) {
  try {
    const watermarkPath = path.join(__dirname, '../../backend/public/imagens/.png');

    if (!fs.existsSync(watermarkPath)) {
      console.warn('[DANFE] Marca d’água PRODUTOS: arquivo não encontrado em', watermarkPath);
      return;
    }

    // ✅ PADRÃO FIXO (use a página 2 como referência)
    // Ajuste esses 2 números 1 vez e pronto.
    const FIXED_W = 240;  // largura padrão
    const FIXED_H = 210;  // altura padrão

    // Centraliza no bloco (posição depende do bloco; tamanho NÃO)
    const xCenter = x + (w - FIXED_W) / 2;

    // Mantém seu "subir um pouco", mas com limite pra não sair do bloco
    const offsetY = 18;
    let yCenter = y + (h - FIXED_H) / 2 - offsetY;
    yCenter = Math.max(y + 6, yCenter);

    doc.save();
    doc.opacity(0.20);

    // ✅ usa fit para preservar proporção dentro do tamanho fixo
    doc.image(watermarkPath, xCenter, yCenter, { fit: [FIXED_W, FIXED_H] });

    doc.restore();
  } catch (e) {
    console.error('[DANFE] Erro ao aplicar marca d’água em PRODUTOS:', e);
  }
}

// ──────────────────────────────────────────────────────────────
// Extrai FATURA / DUPLICATAS do XML (prioriza <cobr>, cai para <pag/detPag>)
// Compatível com xml2js { explicitArray: false }
// ──────────────────────────────────────────────────────────────
async function extractFaturaFromInfNFe(rootInfNFe = {}) {
  const toArr = (v) => (Array.isArray(v) ? v : (v != null ? [v] : []));
  let fatura = null;
  let duplicatas = [];
  let formasPagamento = [];
  const paymentMethods = await loadActivePaymentMethods();

  const money = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // ============================================================
  // 1) COBRANÇA (duplicatas)
  // ============================================================
  const cobr = findByKey(rootInfNFe, 'cobr');

  if (cobr) {
    const fatNode = cobr.fat;
    if (fatNode) {
      const fat = Array.isArray(fatNode) ? fatNode[0] : fatNode;
      fatura = {
        numero: fat.nFat ?? null,
        valorOriginal: fat.vOrig != null ? Number(fat.vOrig) : null,
        valorLiquido: fat.vLiq != null ? Number(fat.vLiq) : null,
      };
    }

    const dupList = toArr(cobr.dup);

    duplicatas = dupList.map((d, idx) => ({
      numero: d.nDup ?? String(idx + 1).padStart(3, '0'),
      vencimento: d.dVenc || null,
      valor: d.vDup != null ? Number(d.vDup) : null,
    }));
  }

  // ============================================================
  // 2) FORMAS DE PAGAMENTO (detPag)
  // ============================================================
  const pag = findByKey(rootInfNFe, 'pag');
  const detPag = toArr(pag?.detPag);

  if (detPag.length) {
    const dataEmissaoBase =
      rootInfNFe?.ide?.dhEmi ||
      rootInfNFe?.ide?.dEmi ||
      null;

    // 🔥 CONTROLE DE USO DAS DUPLICATAS
    const usedDupIndexes = new Set();

    formasPagamento = detPag.map((p, index) => {
      const valorNum = Number(p.vPag ?? 0);

      let dup = null;
      let dupIndex = -1;

      // ========================================================
      // 🔥 REGRA PRINCIPAL (FIX DO BUG)
      // ========================================================
      if (index < duplicatas.length && !usedDupIndexes.has(index)) {
        dup = duplicatas[index];
        dupIndex = index;
      } else {
        // fallback: próxima duplicata livre
        for (let i = 0; i < duplicatas.length; i++) {
          if (!usedDupIndexes.has(i)) {
            dup = duplicatas[i];
            dupIndex = i;
            break;
          }
        }
      }

      if (dupIndex >= 0) {
        usedDupIndexes.add(dupIndex);
      }

      const vencimento =
        p.dVenc ||
        dup?.vencimento ||
        dup?.dVenc ||
        null;

      const tipo = resolvePaymentMethodName(p);

      return {
        tipo,
        tPag: String(p.tPag ?? '').padStart(2, '0'),
        valor: valorNum,
        valorFmt: money(valorNum),
        bandeira: p.card?.CNPJ || p.card?.tBand || null,
        autorizacao: p.card?.cAut || null,
        vencimento,
      };
    });

    if (!fatura) {
      const total = detPag.reduce((s, p) => s + Number(p.vPag ?? 0), 0);
      fatura = {
        numero: null,
        valorOriginal: total,
        valorLiquido: total,
      };
    }
  }

  return { fatura, duplicatas, formasPagamento };
}

function buildPaymentCards({ paymentText, infAdPaymentText, listaDupResolvida = [] }) {
  // 1) prioridade: dados estruturados
  if (Array.isArray(listaDupResolvida) && listaDupResolvida.length) {
    return listaDupResolvida.map((dup, idx) => ({
      tipo: dup?.tipo || `PARCELA ${String(idx + 1).padStart(3, '0')}`,
      numero: dup?.numero || String(idx + 1).padStart(3, '0'),
      vencimento: dup?.vencimento || dup?.dVenc || null,
      valor: dup?.valorFmt || null,
    }));
  }

  // 2) fallback: texto corrido
  const raw = String(paymentText || infAdPaymentText || '').trim();
  if (!raw) return [];

  const partes = raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const formas = [];
  const parcelas = [];

  for (const parte of partes) {
    const upper = normalizeText(parte);

    if (upper.includes('FORMA DE PAGAMENTO')) {
      const semPrefixo = parte.replace(/FORMA DE PAGAMENTO\s*:\s*/i, '').trim();
      if (semPrefixo) formas.push(semPrefixo);
      continue;
    }

    if (
      upper.includes('BOLETO') ||
      upper.includes('PIX') ||
      upper.includes('CARTAO') ||
      upper.includes('CARTÃO') ||
      upper.includes('DINHEIRO') ||
      upper.includes('TRANSFER') ||
      upper.includes('DEPOSITO') ||
      upper.includes('DEPÓSITO') ||
      upper.includes('CHEQUE')
    ) {
      formas.push(parte);
      continue;
    }

    if (upper.includes('PARCELA') || upper.includes('DUPLICATA')) {
      parcelas.push(parte.replace(/^DUPLICATAS?\s*:\s*/i, '').trim());
    }
  }

  const total = Math.max(formas.length, parcelas.length);
  const cards = [];

  for (let i = 0; i < total; i++) {
    const forma = formas[i] || '';
    const parcela = parcelas[i] || '';

    const numeroMatch = parcela.match(/PARCELA\s*([0-9]+)/i);
    const vencMatch = parcela.match(/VENC\.?\s*:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    const valorParcelaMatch = parcela.match(/VALOR\s*:\s*R?\$?\s*([0-9\.\,]+)/i);
    const valorFormaMatch = forma.match(/R?\$?\s*([0-9\.\,]+)/i);

    const tipoFmt = forma
      .replace(/-\s*R?\$?\s*[0-9\.\,]+/i, '')
      .replace(/^FORMA DE PAGAMENTO\s*:\s*/i, '')
      .trim();

    cards.push({
      tipo: tipoFmt || `PARCELA ${String(i + 1).padStart(3, '0')}`,
      numero: numeroMatch ? numeroMatch[1].padStart(3, '0') : String(i + 1).padStart(3, '0'),
      vencimento: vencMatch ? vencMatch[1] : '—',
      valor: valorParcelaMatch
        ? `R$ ${valorParcelaMatch[1]}`
        : valorFormaMatch
          ? `R$ ${valorFormaMatch[1]}`
          : 'R$ 0,00',
    });
  }

  return cards;
}

// ======================================================================
// 🚀 Função principal: gera DANFE em Buffer a partir de um XML
// ======================================================================

export async function generateDanfeFromXml({
  numero = '000123',
  serie = '1',
  chave = '',
  xmlFile = null,
  xmlContent = null,
  prot = {},
  paymentText = null,

  complementaryInfo = null,
  orderItems = [],
  orderPayments = [],
  orderInstallments = [],
  orderDuplicatas = [],
  orderShipping = null,

  // New
  preview = false,

} = {}) {

  console.log('🧩 generateDanfeFromXml params:', {
    numero,
    serie,
    hasXmlContent: !!xmlContent,
    chave: String(chave || '').slice(0, 8) +
      (String(chave || '').length ? '…' : ''),
    xmlFile,
  });

  console.log('[DANFE][ORDER SHIPPING PARAM]', orderShipping);

  // 1) obter XML (string ou arquivo)
  let xmlPath = null;
  let xmlStr = xmlContent || null;

  if (!xmlStr) {
    const ach = localizarXMLPorChaveOuNome({ chave, xmlFile });
    xmlPath = ach.caminho;

    if (!xmlPath) {
      const msg = [
        'Arquivo XML não encontrado para a chave/arquivo informado.',
        `Parâmetros: chave="${chave}", xmlFile="${xmlFile}"`,
      ].join('\n');

      throw new Error(msg);
    }

    xmlStr = fs.readFileSync(xmlPath, 'utf-8');
  }

  // 2) parse do XML
  const parsed = await parseStringPromise(xmlStr);

  const { nfeProc, NFe: NFeNode, infNFe } = getInfNFe(parsed);

  if (!infNFe) {
    console.error(
      '[DANFE] infNFe não encontrado. Raiz tem chaves:',
      Object.keys(parsed || {}),
    );

    throw new Error('Não foi possível extrair os dados da NFe.');
  }

  const asArray = (x) =>
    Array.isArray(x) ? x : x ? [x] : [];

  function extractDetRobusto(rootNFe) {
    const encontrados = [];

    (function walk(o) {
      if (!o || typeof o !== 'object') return;

      if (o.prod && (o.prod.cProd || o.prod.xProd)) {
        encontrados.push(o);
      }

      for (const k of Object.keys(o)) {
        const v = o[k];
        if (v && typeof v === 'object') walk(v);
      }
    })(rootNFe);

    return encontrados;
  }

  const ide = infNFe.ide || {};
  const emit = infNFe.emit || {};
  const dest = infNFe.dest || {};
  const endDest = dest?.enderDest || dest?.ender || {};
  const naturezaOperacao = ide?.natOp || 'VENDA DE MERCADORIA';

  // ✅ Extrai fatura/duplicatas de forma robusta
  const { fatura, duplicatas, formasPagamento } = await extractFaturaFromInfNFe(infNFe);

  console.log('[DANFE] Fatura extraída:', fatura);
  console.log('[DANFE] Duplicatas extraídas:', duplicatas);
  console.log('[DANFE] Formas de pagamento extraídas:', formasPagamento);

  // Monta texto de DUPLICATAS / PAGAMENTO para usar em "Informações Complementares"
  let duplicatasInfoText = null;
  let paymentInfoText = null;

  const infAdOriginal = String(
    complementaryInfo ??
    infNFe?.infAdic?.infCpl ??
    ''
  ).trim();

  const infAdPaymentText = extractPaymentTextFromInfCpl(infAdOriginal);
  const infAdHasExplicitPayment = hasExplicitPaymentInfo(infAdOriginal);

  const effectivePayments =
    Array.isArray(orderPayments) && orderPayments.length
      ? orderPayments
      : Array.isArray(formasPagamento) && formasPagamento.length
        ? formasPagamento
        : [];

  const effectiveInstallments =
    Array.isArray(orderInstallments) && orderInstallments.length
      ? orderInstallments
      : [];

  const effectiveDuplicatas =
    Array.isArray(orderDuplicatas) && orderDuplicatas.length
      ? orderDuplicatas
      : Array.isArray(duplicatas) && duplicatas.length
        ? duplicatas
        : [];

  console.log('[DANFE] paymentText(param)=', paymentText);
  console.log('[DANFE] infAdOriginal=', infAdOriginal);
  console.log('[DANFE] infAdPaymentText=', infAdPaymentText);
  console.log('[DANFE] infAdHasExplicitPayment=', infAdHasExplicitPayment);
  console.log('[DANFE] formasPagamento=', formasPagamento);
  console.log('[DANFE] duplicatas=', duplicatas);

  const moneyText = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (paymentText && String(paymentText).trim()) {
    paymentInfoText = String(paymentText).trim();
  } else if (infAdPaymentText) {
    paymentInfoText = infAdPaymentText;
  } else if (!infAdHasExplicitPayment && effectiveDuplicatas.length) {
    const linhas = effectiveDuplicatas.map((dup, idx) => {
      const num = dup.numero || String(idx + 1).padStart(3, '0');

      const dVencRaw = dup.vencimento || dup.dVenc || null;
      const venc = dVencRaw
        ? String(dVencRaw).split('T')[0].split('-').reverse().join('/')
        : '—';

      const valorFmt = moneyText(dup.valor ?? dup.vDup ?? 0);

      return `• ${num} – VENC.: ${venc} – VALOR: R$ ${valorFmt}`;
    });

    duplicatasInfoText = ['DUPLICATAS:', ...linhas].join('\n');
  }

  if (!duplicatasInfoText && !paymentInfoText && effectivePayments.length) {
    const partes = effectivePayments.map(
      (fp) => `${fp.tipo} – R$ ${fp.valorFmt}`,
    );

    paymentInfoText = `FORMA DE PAGAMENTO: ${partes.join(' | ')}`;
  }

  let itensDet = asArray(infNFe?.det);

  if (!itensDet.length) itensDet = asArray(NFeNode?.det);
  if (!itensDet.length) itensDet = extractDetRobusto(NFeNode);

  if (!itensDet.length) {
    console.warn('[DANFE] Nenhum item encontrado na NFe.');
  } else {
    console.log(`[DANFE] Itens encontrados: ${itensDet.length}`);
  }

  const { infProt } = getProt(nfeProc || parsed);

  const statusDb = String(
    prot?.status || prot?.nfe_status || prot?.nfeStatus || prot?.situacao || ''
  ).toLowerCase();

  const canceladaForcadaDb =
    statusDb.includes('cancel') ||
    statusDb.includes('cancela') ||
    statusDb.includes('101');

  const canceladaXml = isNfeCancelada({ prot, infProt, parsed });
  const cancelada = canceladaForcadaDb || canceladaXml;

  console.log('[DANFE] statusDb=', statusDb);
  console.log('[DANFE] canceladaForcadaDb=', canceladaForcadaDb);
  console.log('[DANFE] canceladaXml=', canceladaXml);
  console.log('[DANFE] cancelada(final)=', cancelada);

  let chaveBarRaw = extrairChave44({ parsed, xmlPath, paramChave: chave });

  if (!/^\d{44}$/.test(chaveBarRaw)) {
    const calc = calcularChave44DeInfNFe(infNFe);

    if (calc) {
      console.log('[DANFE] Chave calculada localmente (pré-autorização).');
      chaveBarRaw = calc;
    }
  }

  let barcodeBuffer = null;

  if (chaveBarRaw && /^\d{44}$/.test(chaveBarRaw)) {
    try {
      barcodeBuffer = await bwipjs.toBuffer({
        bcid: 'code128',
        text: chaveBarRaw,
        scale: 2,
        height: 15,
        includetext: false,
      });
    } catch (e) {
      console.warn(
        '[DANFE] Falha ao gerar código de barras. Continuando sem barras.',
        e.message,
      );
    }
  } else {
    console.warn(
      '[DANFE] Chave de acesso ausente/ inválida. Renderizando sem código de barras.',
    );
  }

  // 3) Criar PDF em memória
  const doc = new PDFDocument({ size: 'A4', margin: 20 });


  // ✅ Watermark must be drawn LAST (on top)
  function stampDocumentStatusOnTop() {
    // CANCELADO tem prioridade: uma prévia/homologação cancelada mostra as duas marcas
    // (antes, "preview" retornava cedo e o cancelamento nunca aparecia)
    if (cancelada) {
      aplicarMarcaDAguaCancelado(doc);
      if (preview) aplicarMarcaDAguaSemValorFiscal(doc, { fontSize: 36, offsetY: 90 });
      return;
    }

    if (preview) {
      aplicarMarcaDAguaSemValorFiscal(doc);
    }
  }

  const pdfChunks = [];
  const bufferPromise = new Promise((resolve, reject) => {
    doc.on('data', (c) => pdfChunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(pdfChunks)));
    doc.on('error', reject);
  });

  // ------------------------------------------------------------------
  // Nome do arquivo PDF
  // Formato: DANFE <NUMERO NF> <NOME DO CLIENTE>.pdf
  // ------------------------------------------------------------------
  const numeroNF = ide?.nNF
    ? String(ide.nNF).padStart(9, '0')
    : String(numero).padStart(3, '0');

  const nomeDestinatario =
    dest?.xNome ||
    emit?.xNome ||
    'CLIENTE';

  const nomeLimpo = sanitizeFileName(nomeDestinatario).toUpperCase();

  const nomePDF = `DANFE ${numeroNF} ${nomeLimpo}.pdf`;

  // ======================================================================
  //  LAYOUT DO DANFE
  // ======================================================================

  const margemX = 20;
  const larguraTotal = 545;

  const emissaoISO = ide?.dhEmi || ide?.dEmi || '';
  const dataEmissao = emissaoISO
    ? (emissaoISO.split('T')[0] || '')
      .split('-')
      .reverse()
      .join('/')
    : '--/--/----';

  const valorTotalNF = Number(infNFe?.total?.ICMSTot?.vNF || 0);
  const valorTotalFmt = valorTotalNF.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  const destinatario = dest?.xNome || '---';
  const enderecoStr = [
    endDest.xLgr,
    endDest.nro,
    endDest.xBairro,
    endDest.xMun,
    endDest.UF,
  ]
    .filter(Boolean)
    .join(', ');

  const margemY = 10;
  const larguraNF = 105;
  const alturaCanhoto = 25;
  const paddingInterno = 5;

  doc
    .lineWidth(0.3)
    .roundedRect(
      margemX,
      margemY,
      larguraTotal - larguraNF,
      alturaCanhoto,
      3,
    )
    .stroke();

  const textoCanhoto = `RECEBEMOS DE ${emit?.xNome || '---'
    } OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ${dataEmissao} VALOR TOTAL: ${valorTotalFmt} DESTINATÁRIO: ${destinatario} - ${enderecoStr}`;
  doc
    .font('Helvetica')
    .fontSize(6)
    .text(textoCanhoto, margemX + paddingInterno, margemY + paddingInterno, {
      width: larguraTotal - larguraNF - paddingInterno * 2,
      align: 'left',
    });

  const alturaCampoRecebimento = 20;
  const larguraCampoRecebimento = 100;
  const posXRecebimento = margemX;
  const posYRecebimento = margemY + alturaCanhoto;

  doc
    .fontSize(5)
    .text(
      'DATA DE RECEBIMENTO',
      posXRecebimento + paddingInterno,
      posYRecebimento + 2,
    );
  doc
    .lineWidth(0.3)
    .roundedRect(
      posXRecebimento,
      posYRecebimento,
      larguraCampoRecebimento,
      alturaCampoRecebimento,
      2,
    )
    .stroke();

  const larguraCampoAssinatura = 340;
  const alturaCampoAssinatura = 20;
  const posXAssinatura = posXRecebimento + larguraCampoRecebimento;
  const posYAssinatura = posYRecebimento;

  doc
    .fontSize(5)
    .text(
      'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR',
      posXAssinatura + paddingInterno,
      posYAssinatura + 2,
    );
  doc
    .lineWidth(0.3)
    .roundedRect(
      posXAssinatura,
      posYAssinatura,
      larguraCampoAssinatura,
      alturaCampoAssinatura,
      2,
    )
    .stroke();

  // Quadrito "NF-e" do canhoto — alinhado e formatado
  const larguraQuadroNFE = 120;
  const alturaQuadroNFE = 45;
  const posXNFE = margemX + larguraTotal - larguraQuadroNFE + 15;
  const posYNFE = margemY;

  // Número e série formatados
  const nNfRaw = ide?.nNF;
  const nNf = nNfRaw ? String(nNfRaw).padStart(9, '0') : '000000000';
  const nNfFmt = nNf.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');

  const serieRaw = ide?.serie;
  const serieFmt = serieRaw ? String(serieRaw).padStart(3, '0') : '001';

  // Moldura do quadro
  doc
    .lineWidth(0.3)
    .roundedRect(posXNFE, posYNFE, larguraQuadroNFE, alturaQuadroNFE, 3)
    .stroke();

  // Título NF-e
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('NF-e', posXNFE, posYNFE + 4, {
      width: larguraQuadroNFE,
      align: 'center',
    });

  // Número e Série
  doc
    .fontSize(8)
    .text(`Nº ${nNfFmt}`, posXNFE, posYNFE + 20, {
      width: larguraQuadroNFE,
      align: 'center',
    })
    .text(`Série ${serieFmt}`, posXNFE, posYNFE + 30, {
      width: larguraQuadroNFE,
      align: 'center',
    });

  // ===============================
  // QUADRO DO EMITENTE (logo + dados)
  // ===============================
  const boxEmit = { x: margemX, y: 58, w: 220, h: 90 };

  doc
    .lineWidth(0.3)
    .roundedRect(boxEmit.x, boxEmit.y, boxEmit.w, boxEmit.h, 3)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('IDENTIFICAÇÃO DO EMITENTE', boxEmit.x, boxEmit.y + 5, {
      width: boxEmit.w,
      align: 'center',
    });

  // Caminho da logo
  const logoPath = path.join(
    __dirname,
    '../../backend/public/imagens/.png'
  );

  // Tamanho máximo da logo dentro do quadro (mantém proporção)
  const LOGO_MAX_W = 100;
  const LOGO_MAX_H = 80;

  const logoX = boxEmit.x + 2;
  const logoY = boxEmit.y + 8;

  let deslocamentoTextoX = 0;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, logoX, logoY, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
    deslocamentoTextoX = LOGO_MAX_W + 16;
  }

  const infoX = boxEmit.x + 5 + deslocamentoTextoX;
  const infoW = boxEmit.w - deslocamentoTextoX - 10;

  const endEmit = emit?.enderEmit || {};

  const linha1 = (emit.xNome || '---').toUpperCase();
  const linha2 = `${endEmit.xLgr || ''}, ${endEmit.nro || ''}`.trim();
  const linha3 = `${(endEmit.xBairro || '').toUpperCase()} - CEP: ${fmtCEP(
    endEmit.CEP || ''
  )}`;
  const fone = endEmit.fone ? ` Fone: ${endEmit.fone}` : '';
  const linha4 = `${(endEmit.xMun || '').toUpperCase()} - ${(endEmit.UF || '')
    .toUpperCase()}${fone}`;

  const enderecoEmitenteTexto = [linha2, linha3, linha4]
    .filter(Boolean)
    .join('\n');

  const textoX = infoX;
  const textoY = boxEmit.y + 26;
  const textoW = infoW;

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(linha1, textoX, textoY, {
      width: textoW,
      align: 'center',
      lineBreak: true,
    });

  const alturaNome = doc.heightOfString(linha1, {
    width: textoW,
    align: 'center',
  });

  doc
    .font('Helvetica')
    .fontSize(6)
    .text(
      enderecoEmitenteTexto,
      textoX,
      textoY + alturaNome + 2,
      {
        width: textoW,
        align: 'center',
      }
    );

  // Moldura “DANFE” — 0-ENTRADA / 1-SAÍDA + NF-e 9 dígitos
  {
    const x = margemX + 220;
    const y = 58;
    const w = 90;
    const h = 90;

    doc.lineWidth(0.3).roundedRect(x, y, w, h, 4).stroke();

    doc.font('Helvetica-Bold')
      .fontSize(11)
      .text('DANFE', x, y + 3, { width: w, align: 'center' });

    doc.font('Helvetica')
      .fontSize(6)
      .text('Documento Auxiliar da Nota', x, y + 17, { width: w, align: 'center' })
      .text('Fiscal Eletrônica', x, y + 27, { width: w, align: 'center' });

    const indEntradaSaida = String(ide?.tpNF ?? '1');

    doc.font('Helvetica')
      .fontSize(6)
      .text('0 - ENTRADA', x + 5, y + 40)
      .text('1 - SAÍDA', x + 5, y + 50);

    const caixaW = 16;
    const caixaH = 16;
    const caixaX = x + w - caixaW - 4;
    const caixaY = y + 40;

    doc.lineWidth(0.3)
      .roundedRect(caixaX, caixaY, caixaW, caixaH, 3)
      .stroke();

    doc.font('Helvetica-Bold')
      .fontSize(10)
      .text(indEntradaSaida, caixaX, caixaY + 3, {
        width: caixaW,
        align: 'center',
      });

    const nNfRaw = ide?.nNF;
    const nNf = nNfRaw ? String(nNfRaw).padStart(9, '0') : '000000000';
    const nNfFmt = nNf.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');

    const serieRaw = ide?.serie;
    const serieFmt = serieRaw ? String(serieRaw).padStart(3, '0') : '001';

    doc.font('Helvetica-Bold')
      .fontSize(8)
      .text(`Nº. ${nNfFmt}`, x, y + 60, { width: w, align: 'center' })
      .text(`Série ${serieFmt}`, x, y + 70, { width: w, align: 'center' });

    doc.font('Helvetica')
      .fontSize(7)
      .text('Folha 1/1', x, y + 80, { width: w, align: 'center' });
  }

  // Bloco chave + barras
  const yBarras = 58;
  const alturaBloco = 90;
  const larguraBloco = 250;

  doc.lineWidth(0.3).roundedRect(margemX + 310, yBarras, larguraBloco, alturaBloco, 4).stroke();
  doc.moveTo(margemX + 310, yBarras + 40).lineTo(margemX + 310 + larguraBloco, yBarras + 40).stroke();
  doc.moveTo(margemX + 310, yBarras + 65).lineTo(margemX + 310 + larguraBloco, yBarras + 65).stroke();

  if (barcodeBuffer) {
    doc.image(barcodeBuffer, margemX + 315, yBarras + 4, { width: 240, height: 30 });
  } else {
    doc.font('Helvetica').fontSize(7).text('Sem chave de acesso para barras', margemX + 320, yBarras + 12);
  }

  doc.fontSize(6).font('Helvetica-Bold').text('CHAVE DE ACESSO', margemX + 312, yBarras + 42);
  const chaveFormatada = String(chaveBarRaw || '').replace(/(\d{4})(?=\d)/g, '$1 ');
  doc.font('Courier-Bold').fontSize(7).text(chaveFormatada || '—', margemX + 320, yBarras + 50, { width: 230 });

  const yConsulta = 140;
  doc.font('Helvetica').fontSize(8)
    .text('Consulta de autenticidade no portal nacional da NF-e', margemX + 348, yConsulta - 15)
    .text('www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', margemX + 330, yConsulta - 5);

  //=================================================================
  // BLOCO COMPOSTO: Natureza + Protocolo + Inscrições (2 linhas) ===
  //=================================================================
  {
    const style = {
      r: 3,
      lineWidth: 0.3,
      titleFont: 6,
      titleBold: true,
      valueFont: 7,
      valueBold: true,
      titleDx: 6,
      titleDy: 4,
      valueDx: 6,
      valueDy: 12,
      align: 'left'
    };

    const snap = v => Math.round(v * 10) / 10;

    const RIGHT = snap(margemX + larguraTotal);

    function field(x, y, w, h, title, value, opt = {}) {
      const s = { ...style, ...opt };
      x = snap(x); y = snap(y); w = snap(w); h = snap(h);
      doc.lineWidth(s.lineWidth).roundedRect(x, y, w, h, s.r).stroke();
      doc.font(s.titleBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(s.titleFont)
        .text(title, x + s.titleDx, y + s.titleDy, { width: w - s.titleDx * 2, align: s.align });
      doc.font(s.valueBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(s.valueFont)
        .text(value, x + s.valueDx, y + s.valueDy, { width: w - s.valueDx * 2, align: s.align });
    }

    function row(x, y, h, cols) {
      let cx = snap(x);
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        const w = snap(c.w);
        field(cx, y, w, h, c.title, c.value, c.opt || {});
        cx = snap(cx + w);
      }
    }

    const fmt = (v, def = '—') => (String(v ?? '').trim() || def);
    const soData = (iso) => { if (!iso) return '—'; const d = String(iso).split('T')[0] || ''; const [Y, M, D] = d.split('-'); return (D && M && Y) ? `${D}/${M}/${Y}` : '—'; };
    const soHora = (iso) => { const t = (String(iso).split('T')[1] || ''); return t ? t.substring(0, 8) : ''; };
    const fmtCNPJCPF = (v) => {
      const d = String(v || '').replace(/\D+/g, '');
      if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
      return fmt(v);
    };

    const natureza = fmt(naturezaOperacao);

    const protNum = String(
      infProt?.nProt ??
      prot?.nProt ??
      ''
    ).trim();

    const dhRecbto = String(
      infProt?.dhRecbto ??
      prot?.dhRecbto ??
      prot?.authorized_at ??
      prot?.authorization_date ??
      ''
    ).trim();

    const protData = dhRecbto
      ? soData(dhRecbto)
      : '';

    const protHora = dhRecbto
      ? soHora(dhRecbto)
      : '';

    const dataHoraAutorizacao = [protData, protHora]
      .filter(Boolean)
      .join(' ');

    const protocoloTxt = dataHoraAutorizacao
      ? `${protNum} - ${dataHoraAutorizacao}`
      : protNum;

    const emitIE = fmt(infNFe?.emit?.IE);
    const emitIM = fmt(infNFe?.emit?.IM);
    const emitIEST = fmt(infNFe?.emit?.IEST);
    const emitDoc = fmtCNPJCPF(infNFe?.emit?.CNPJ || infNFe?.emit?.CPF);

    const yTop = 150;
    const H1 = 24;
    const H2 = 22;

    // === LINHA 1 ===
    row(margemX, yTop, H1, [
      {
        w: 380, title: 'NATUREZA DA OPERAÇÃO', value: natureza,
        opt: { valueFont: 6, valueBold: true }
      },
      {
        w: 180,
        title: 'PROTOCOLO DE AUTORIZAÇÃO DE USO',
        value: protocoloTxt,
        opt: {
          valueFont: 8,
          valueBold: true,
        }
      }
    ]);

    // === LINHA 2 === (IE | IM | IEST | CNPJ/CPF)
    const y2 = yTop + H1;

    row(margemX, y2, H2, [
      { w: 180, title: 'INSCRIÇÃO ESTADUAL', value: emitIE },
      { w: 130, title: 'INSCRIÇÃO MUNICIPAL', value: emitIM },
      { w: 150, title: 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', value: emitIEST },
      { w: 100, title: 'CNPJ / CPF', value: emitDoc }
    ]);
  }

  // ==============================================================================================
  // ============ DESTINATÁRIO / REMETENTE ========================================================
  // ==============================================================================================
  (function renderDestinatario() {
    const defaultFieldStyle = {
      r: 3,
      lineWidth: 0.3,
      titleFont: 5,
      titleBold: true,
      valueFont: 3,
      valueBold: true,
      titleDx: 6,
      titleDy: 4,
      valueDx: 6,
      valueDy: 12,
      align: 'left',
    };

    function drawField(docRef, { x, y, w, h, title, value, style = {} }) {
      const s = { ...defaultFieldStyle, ...style };

      docRef
        .lineWidth(s.lineWidth)
        .roundedRect(x, y, w, h, s.r)
        .stroke();

      docRef
        .font(s.titleBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(s.titleFont)
        .text(String(title ?? ''), x + s.titleDx, y + s.titleDy, {
          width: w - s.titleDx * 2,
          align: s.align,
        });

      docRef
        .font(s.valueBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(s.valueFont)
        .text(String(value ?? ''), x + s.valueDx, y + s.valueDy, {
          width: w - s.valueDx * 2,
          align: s.align,
        });
    }

    const endDest = dest?.enderDest || dest?.ender || {};

    const fmt = (v, def = '—') => {
      const s = String(v ?? '').trim();
      return s || def;
    };

    const soNum = (s = '') => String(s).replace(/\D+/g, '');

    const fmtCEP = (cep = '') => {
      const d = soNum(cep);
      return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, '$1-$2') : fmt(cep);
    };

    const fmtCNPJCPF = (v) => {
      const d = soNum(v || '');

      if (d.length === 14) {
        return d.replace(
          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
          '$1.$2.$3/$4-$5',
        );
      }

      if (d.length === 11) {
        return d.replace(
          /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
          '$1.$2.$3-$4',
        );
      }

      return fmt(v);
    };

    const fmtFone = (v) => {
      const d = soNum(v || '');

      if (d.length === 10) {
        return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
      }

      if (d.length === 11) {
        return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      }

      return fmt(v, '');
    };

    const soData = (iso) => {
      if (!iso) return '—';

      const d = String(iso).split('T')[0] || '';
      if (!d) return '—';

      const [Y, M, D] = d.split('-');
      return D && M && Y ? `${D}/${M}/${Y}` : '—';
    };

    const soHora = (iso) => {
      if (!iso) return '';

      const t = String(iso).split('T')[1] || '';
      return t ? t.substring(0, 8) : '';
    };

    function normalizeUpper(value = '') {
      return String(value ?? '').trim().toUpperCase();
    }

    function montarLogradouroCompleto(endereco = {}) {
      const tipoCandidates = [
        endereco?.tpLogr,
        endereco?.tipoLogradouro,
        endereco?.tipo_logradouro,
        endereco?.logradouroTipo,
        endereco?.logradouro_tipo,
      ];

      const tipo = normalizeUpper(
        tipoCandidates.find((v) => String(v ?? '').trim())
      );

      const logradouro = normalizeUpper(endereco?.xLgr || endereco?.logradouro || '');
      const numero = normalizeUpper(endereco?.nro || endereco?.numero || '');

      let logradouroFinal = logradouro;

      if (tipo && logradouro) {
        if (!logradouro.startsWith(`${tipo} `)) {
          logradouroFinal = `${tipo} ${logradouro}`.trim();
        }
      } else if (tipo && !logradouro) {
        logradouroFinal = tipo;
      }

      if (numero) {
        logradouroFinal = `${logradouroFinal}, ${numero}`.trim();
      }

      return fmt(logradouroFinal);
    }

    const dataSaidaEntrada =
      soData(ide?.dhSaiEnt || ide?.dSaiEnt || '') !== '—'
        ? soData(ide?.dhSaiEnt || ide?.dSaiEnt || '')
        : soData(ide?.dhEmi || ide?.dEmi || '');

    const horaSaidaEntrada =
      soHora(ide?.dhSaiEnt || ide?.dSaiEnt || '') ||
      soHora(ide?.dhEmi || ide?.dEmi || '');

    console.log('[DANFE][DEST] endDest bruto =', JSON.stringify(endDest, null, 2));
    console.log('[DANFE][DEST] xLgr =', endDest?.xLgr);
    console.log('[DANFE][DEST] nro =', endDest?.nro);
    console.log('[DANFE][DEST] xBairro =', endDest?.xBairro);
    console.log('[DANFE][DEST] xMun =', endDest?.xMun);
    console.log('[DANFE][DEST] UF =', endDest?.UF);

    const VAL = {
      nome: fmt(normalizeUpper(dest?.xNome || '')),
      cnpjCpf: fmtCNPJCPF(dest?.CNPJ || dest?.CPF),
      dataEmi: soData(ide?.dhEmi || ide?.dEmi || ''),

      endereco: montarLogradouroCompleto(endDest),
      bairro: fmt(normalizeUpper(endDest?.xBairro || '-')),
      cep: fmtCEP(endDest?.CEP),
      dataSai: dataSaidaEntrada,

      municipio: fmt(normalizeUpper(endDest?.xMun || '')),
      uf: fmt(normalizeUpper(endDest?.UF || ''), ' '),
      fone: fmtFone(endDest?.fone),
      ie: fmt(dest?.IE),
      horaSai: horaSaidaEntrada || '—',
    };

    const cfgDest = {
      xStart: margemX,
      yStart: 208,
      rowGap: 0,
      rows: [
        {
          height: 24,
          fields: [
            {
              key: 'nome',
              title: 'NOME / RAZÃO SOCIAL',
              value: VAL.nome,
              width: 340,
              style: { valueFont: 7, valueBold: true },
            },
            {
              key: 'cnpjCpf',
              title: 'CNPJ / CPF',
              value: VAL.cnpjCpf,
              width: 125,
              style: { valueFont: 7 },
            },
            {
              key: 'dataEmi',
              title: 'DATA DA EMISSÃO',
              value: VAL.dataEmi,
              width: 95,
              style: { valueFont: 7, align: 'left' },
            },
          ],
        },
        {
          height: 24,
          fields: [
            {
              key: 'endereco',
              title: 'ENDEREÇO',
              value: VAL.endereco,
              width: 260,
              style: { valueFont: 7 },
            },
            {
              key: 'bairro',
              title: 'BAIRRO / DISTRITO',
              value: VAL.bairro,
              width: 120,
              style: { valueFont: 7 },
            },
            {
              key: 'cep',
              title: 'CEP',
              value: VAL.cep,
              width: 85,
              style: { valueFont: 7 },
            },
            {
              key: 'dataSai',
              title: 'DATA DA SAÍDA/ENTRADA',
              value: VAL.dataSai,
              width: 95,
              style: { valueFont: 7 },
            },
          ],
        },
        {
          height: 24,
          fields: [
            {
              key: 'municipio',
              title: 'MUNICÍPIO',
              value: VAL.municipio,
              width: 260,
              style: { valueFont: 7 },
            },
            {
              key: 'uf',
              title: 'UF',
              value: VAL.uf,
              width: 35,
              style: { valueFont: 7, align: 'center' },
            },
            {
              key: 'fone',
              title: 'FONE / FAX',
              value: VAL.fone,
              width: 90,
              style: { valueFont: 7 },
            },
            {
              key: 'ie',
              title: 'INSCRIÇÃO ESTADUAL',
              value: VAL.ie,
              width: 80,
              style: { valueFont: 7 },
            },
            {
              key: 'horaSai',
              title: 'HORA DA SAÍDA/ENTRADA',
              value: VAL.horaSai,
              width: 95,
              style: { valueFont: 7, align: 'center' },
            },
          ],
        },
      ],
    };

    const titleX = cfgDest.xStart + 6;
    const titleY = cfgDest.yStart - 7;

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .text('DESTINATÁRIO / REMETENTE', titleX, titleY, {
        width: 350,
        align: 'left',
      });

    let y = cfgDest.yStart;
    cfgDest.rows.forEach((row) => {
      const h = row.height;
      let x = cfgDest.xStart;

      row.fields.forEach((f) => {
        drawField(doc, {
          x,
          y,
          w: f.width,
          h,
          title: f.title,
          value: f.value,
          style: f.style,
        });
        x += f.width;
      });

      y += h + (cfgDest.rowGap || 0);
    });
  })();

  // ============================================================================
  // ============================= FATURA / DUPLICATAS ==========================
  // ============================================================================
  const yFatura = 282;
  let alturaQuadroDup = 38;
  const alturaLinhaFatura = 22;

  {
    const larguraQuadroDup = 560;
    const xBase = margemX;

    const money = (v) =>
      Number(v || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const formatDateBR = (raw) => {
      if (!raw) return '—';

      const s = String(raw).trim();
      if (!s) return '—';

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

      const iso = s.split('T')[0];
      const parts = iso.split('-');
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        if (yyyy && mm && dd) return `${dd}/${mm}/${yyyy}`;
      }

      return s;
    };

    const normalizeMoneyBR = (value) => {
      if (value == null || value === '') return 'R$ 0,00';

      const s = String(value).trim();

      if (/^R?\$?\s*\d{1,3}(\.\d{3})*,\d{2}$/.test(s) || /^R?\$?\s*\d+,\d{2}$/.test(s)) {
        return s.startsWith('R$') ? s : `R$ ${s.replace(/^\$\s*/, '')}`;
      }

      const num = Number(
        s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
      );

      if (!Number.isFinite(num)) return 'R$ 0,00';

      return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
    };

    const parsePaymentCardsFromText = (text) => {
      const raw = String(text || '').trim();
      if (!raw) return [];

      const partes = raw
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);

      const formas = [];
      const parcelas = [];

      for (const parte of partes) {
        const up = normalizeText(parte);

        if (up.includes('FORMA DE PAGAMENTO')) {
          const semPrefixo = parte.replace(/FORMA DE PAGAMENTO\s*:\s*/i, '').trim();
          if (semPrefixo) formas.push(semPrefixo);
          continue;
        }

        if (
          up.includes('BOLETO') ||
          up.includes('PIX') ||
          up.includes('CARTAO') ||
          up.includes('CARTÃO') ||
          up.includes('DINHEIRO') ||
          up.includes('TRANSFER') ||
          up.includes('DEPOSITO') ||
          up.includes('DEPÓSITO') ||
          up.includes('CHEQUE')
        ) {
          formas.push(parte);
          continue;
        }

        if (up.includes('PARCELA') || up.includes('DUPLICATA')) {
          parcelas.push(parte.replace(/^DUPLICATAS?\s*:\s*/i, '').trim());
        }
      }

      const total = Math.max(formas.length, parcelas.length);
      const cards = [];

      for (let i = 0; i < total; i++) {
        const forma = formas[i] || '';
        const parcela = parcelas[i] || '';

        const numeroMatch = parcela.match(/PARCELA\s*([0-9]+)/i);
        const vencMatch = parcela.match(/VENC\.?\s*:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
        const valorParcelaMatch = parcela.match(/VALOR\s*:\s*R?\$?\s*([0-9\.\,]+)/i);
        const valorFormaMatch = forma.match(/R?\$?\s*([0-9\.\,]+)/i);

        const tipoFmt = forma
          .replace(/-\s*R?\$?\s*[0-9\.\,]+/i, '')
          .replace(/^FORMA DE PAGAMENTO\s*:\s*/i, '')
          .trim();

        cards.push({
          tipo: tipoFmt || `PARCELA ${String(i + 1).padStart(3, '0')}`,
          numero: numeroMatch
            ? numeroMatch[1].padStart(3, '0')
            : String(i + 1).padStart(3, '0'),
          vencimento: vencMatch ? vencMatch[1] : '—',
          valorFmt: valorParcelaMatch
            ? normalizeMoneyBR(valorParcelaMatch[1])
            : valorFormaMatch
              ? normalizeMoneyBR(valorFormaMatch[1])
              : 'R$ 0,00',
        });
      }

      // renumera automaticamente em sequência
      return cards.map((c, idx) => ({
        ...c,
        numero: String(idx + 1).padStart(3, '0'),
      }));
    };

    const listaDup = Array.isArray(effectiveDuplicatas) ? effectiveDuplicatas.filter(Boolean) : [];
    const listaPag = Array.isArray(effectivePayments) ? effectivePayments.filter(Boolean) : [];
    const listaInst = Array.isArray(effectiveInstallments) ? effectiveInstallments.filter(Boolean) : [];

    const listaDupResolvida = listaDup.map((dup, idx) => {
      const valorDup = Number(dup?.valor ?? dup?.vDup ?? 0);
      const vencDup = dup?.vencimento || dup?.dVenc || null;

      let pagamentoMatch = listaPag.find((fp) => {
        const vencFp = fp?.vencimento || null;
        return vencFp && vencDup && String(vencFp).split('T')[0] === String(vencDup).split('T')[0];
      });

      if (!pagamentoMatch) {
        pagamentoMatch = listaPag.find((fp) => {
          const valorFp = Number(fp?.valor ?? 0);
          return Math.abs(valorFp - valorDup) < 0.01;
        });
      }

      if (!pagamentoMatch && listaPag[idx]) {
        pagamentoMatch = listaPag[idx];
      }

      return {
        ...dup,
        tipo: pagamentoMatch?.tipo || null,
        valorFmt: money(valorDup),
        vencimentoFmt: formatDateBR(vencDup),
      };
    });

    const cardsFromStructuredData = listaDupResolvida.length
      ? listaDupResolvida.map((dup, idx) => ({
        tipo: dup.tipo || `PARCELA ${String(idx + 1).padStart(3, '0')}`,
        numero: String(idx + 1).padStart(3, '0'),
        vencimento: dup.vencimentoFmt || formatDateBR(dup.vencimento || dup.dVenc || null),
        valorFmt: dup.valorFmt || money(dup.valor ?? dup.vDup ?? 0),
      }))
      : [];

    const parsedFromPaymentText = parsePaymentCardsFromText(paymentText);
    const parsedFromInfAdText = parsePaymentCardsFromText(infAdPaymentText);

    const cardsFromText = parsedFromPaymentText.length
      ? parsedFromPaymentText
      : parsedFromInfAdText.length
        ? parsedFromInfAdText
        : [];

    const cardsToRender = cardsFromStructuredData.length
      ? cardsFromStructuredData
      : cardsFromText;

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .text('DUPLICATAS', xBase + 2, yFatura + 1);

    // --------------------------------------------------------------------------
    // 1) Todas as parcelas na mesma linha horizontal
    // --------------------------------------------------------------------------
    if (cardsToRender.length) {
      const cards = cardsToRender;

      const maxColumns = 5;
      const columnGap = 5;
      const cardHeight = 28;

      // 1 parcela = 1/5 da largura; 5 parcelas = linha inteira
      const cardWidth =
        (larguraQuadroDup - columnGap * (maxColumns - 1)) / maxColumns;

      const baseY = yFatura + 8;

      alturaQuadroDup = 38;

      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];

        const xCard = xBase + index * (cardWidth + columnGap);
        const yCard = baseY;

        const installmentNumber =
          card.numero || String(index + 1).padStart(3, '0');

        doc
          .lineWidth(0.3)
          .roundedRect(xCard, yCard, cardWidth, cardHeight, 2)
          .stroke();

        doc
          .font('Helvetica-Bold')
          .fontSize(5.2)
          .text(`PARCELA ${installmentNumber}`, xCard + 3, yCard + 2, {
            width: cardWidth - 6,
            align: 'left',
            lineBreak: false,
          });

        doc
          .font('Helvetica')
          .fontSize(4.9)
          .text(`Venc.: ${card.vencimento || '—'}`, xCard + 3, yCard + 11, {
            width: cardWidth - 6,
            align: 'left',
            lineBreak: false,
          })
          .text(`Valor: ${card.valorFmt || 'R$ 0,00'}`, xCard + 3, yCard + 18, {
            width: cardWidth - 6,
            align: 'left',
            lineBreak: false,
          });
      }
    }

    // --------------------------------------------------------------------------
    // 2) FALLBACK texto corrido (paymentText)
    // --------------------------------------------------------------------------
    else if (paymentText && String(paymentText).trim()) {
      const boxY = yFatura + 8;
      const boxH = alturaQuadroDup - 10;

      doc
        .lineWidth(0.3)
        .roundedRect(xBase, boxY, larguraQuadroDup, boxH, 3)
        .stroke();

      const linhasBrutas = String(paymentText)
        .replace(/\r/g, '\n')
        .split(/\||\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const linhas = linhasBrutas.slice(0, 3);

      doc
        .font('Helvetica')
        .fontSize(6)
        .text(linhas.join('\n'), xBase + 6, boxY + 5, {
          width: larguraQuadroDup - 12,
          align: 'left',
        });
    }

    // --------------------------------------------------------------------------
    // 3) FALLBACK texto das informações complementares
    // --------------------------------------------------------------------------
    else if (infAdPaymentText) {
      const boxY = yFatura + 8;
      const boxH = alturaQuadroDup - 10;

      doc
        .lineWidth(0.3)
        .roundedRect(xBase, boxY, larguraQuadroDup, boxH, 3)
        .stroke();

      const linhasBrutas = String(infAdPaymentText)
        .replace(/\r/g, '\n')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const linhas = linhasBrutas.slice(0, 3);

      doc
        .font('Helvetica')
        .fontSize(6)
        .text(linhas.join('\n'), xBase + 6, boxY + 5, {
          width: larguraQuadroDup - 12,
          align: 'left',
        });
    }

    // --------------------------------------------------------------------------
    // 4) FALLBACK: formas de pagamento genéricas
    // --------------------------------------------------------------------------
    else if (listaPag.length) {
      const boxY = yFatura + 8;
      const boxH = alturaQuadroDup - 10;

      doc
        .lineWidth(0.3)
        .roundedRect(xBase, boxY, larguraQuadroDup, boxH, 3)
        .stroke();

      const linhas = listaPag.slice(0, 3).map((fp) => {
        const tipo = fp.tipo || 'FORMA NÃO INFORMADA';
        const valorFmt = fp.valorFmt || money(fp.valor || 0);
        const venc = fp.vencimento
          ? ` - VENC.: ${formatDateBR(fp.vencimento)}`
          : '';

        return `${tipo} - VALOR: ${valorFmt}${venc}`;
      });

      doc
        .font('Helvetica')
        .fontSize(6)
        .text(linhas.join('\n'), xBase + 6, boxY + 5, {
          width: larguraQuadroDup - 12,
          align: 'left',
        });
    }
  }

  // ============================================================================
  // ======================== CÁLCULO DO IMPOSTO ================================
  // ============================================================================
  const yImposto = yFatura + alturaQuadroDup + 12;
  const impostos = infNFe?.total?.ICMSTot || {};
  const valorIPI = Number(impostos?.vIPI || 0);
  const valorTotal = Number(impostos?.vNF || 0);

  const camposImposto = [
    { titulo: 'BASE DE CÁLC. DO ICMS', valor: impostos.vBC },
    { titulo: 'VALOR DO ICMS', valor: impostos.vICMS },
    { titulo: 'BASE DE CÁLC. ICMS ST', valor: impostos.vBCST },
    { titulo: 'VALOR DO ICMS SUBST.', valor: impostos.vST },
    { titulo: 'V. IMP. IMPORTAÇÃO', valor: impostos.vII },
    { titulo: 'V. ICMS UF REMET.', valor: impostos.vICMSUFRemet },
    { titulo: 'V. FCP UF DEST.', valor: impostos.vFCPUFDest },
    { titulo: 'V. TOTAL PRODUTOS', valor: impostos.vProd }
  ];

  const camposImposto2 = [
    { titulo: 'VALOR DO FRETE', valor: impostos.vFrete },
    { titulo: 'VALOR DO SEGURO', valor: impostos.vSeg },
    { titulo: 'DESCONTO', valor: impostos.vDesc },
    { titulo: 'OUTRAS DESPESAS', valor: impostos.vOutro },
    { titulo: 'VALOR TOTAL IPI', valor: valorIPI },
    { titulo: 'V. ICMS UF DEST.', valor: impostos.vICMSUFDest },
    { titulo: 'V. TOT. TRIB.', valor: impostos.vTotTrib },
    { titulo: 'V. TOTAL DA NOTA', valor: valorTotal }
  ];

  const larguraCampoImposto = 70;
  camposImposto.forEach((c, i) => {
    const x = margemX + i * larguraCampoImposto;
    doc.lineWidth(0.3).roundedRect(x, yImposto, larguraCampoImposto, alturaLinhaFatura, 3).stroke();
    doc.font('Helvetica-Bold').fontSize(5).text(c.titulo, x + 2, yImposto + 2);
    doc.font('Helvetica').fontSize(7).text(Number(c.valor || 0).toFixed(2), x + 2, yImposto + 10);
  });

  camposImposto2.forEach((c, i) => {
    const x = margemX + i * larguraCampoImposto;
    doc.lineWidth(0.3).roundedRect(x, yImposto + alturaLinhaFatura, larguraCampoImposto, alturaLinhaFatura, 3).stroke();
    doc.font('Helvetica-Bold').fontSize(5).text(c.titulo, x + 2, yImposto + alturaLinhaFatura + 2);
    doc.font('Helvetica').fontSize(7).text(Number(c.valor || 0).toFixed(2), x + 2, yImposto + alturaLinhaFatura + 10);
  });

  doc.font('Helvetica-Bold').fontSize(6).text('CÁLCULO DO IMPOSTO', margemX + 2, yImposto - 10);

  // ============================================================================
  // =================== TRANSPORTADORA E VOLUMES (células arredondadas) ========
  // ============================================================================
  let yProdutosInicio;

  {
    const yTransp = yImposto + alturaLinhaFatura * 2 + 10;
    const larguraTabela = 560; // 🔒 largura fixa da tabela (todas as linhas)

    const style = {
      r: 3,
      lineWidth: 0.3,
      titleFont: 6,
      titleBold: true,
      valueFont: 9,
      valueBold: true,
      titleDx: 6,
      titleDy: 3,
      valueDx: 6,
      valueDy: 10,
      align: 'left',
      gapX: 0,
      gapY: 0,

      // ✅ Auto-ajuste do valor dentro da célula
      autoFit: true,          // reduz a fonte até o texto caber
      minValueFont: 5.5,      // menor fonte aceita em 1 linha
      maxMultilineFont: 6.5,  // maior fonte ao quebrar em 2 linhas
      minMultilineFont: 4.5,  // menor fonte aceita em 2 linhas
    };

    const RIGHT = margemX + larguraTabela;
    const snap = v => Math.round(v * 10) / 10;

    // ── Auto-ajuste do valor ────────────────────────────────────────────────
    // 1) Tenta 1 linha, reduzindo a fonte até minValueFont.
    // 2) Se não couber, tenta 2 linhas com fonte menor.
    // 3) Em último caso, trunca com "..." na fonte mínima.
    function fitCellValue(text, maxWidth, maxHeightMulti, baseSize, fontName, s) {
      const value = String(text ?? '').trim();
      doc.font(fontName);

      if (!value || maxWidth <= 0) {
        return { size: baseSize, multiline: false, text: value };
      }

      for (let size = baseSize; size >= s.minValueFont; size -= 0.25) {
        doc.fontSize(size);
        if (doc.widthOfString(value) <= maxWidth) {
          return { size, multiline: false, text: value };
        }
      }

      const startMulti = Math.min(baseSize, s.maxMultilineFont);

      for (let size = startMulti; size >= s.minMultilineFont; size -= 0.25) {
        doc.fontSize(size);

        const needed = doc.heightOfString(value, { width: maxWidth, lineGap: 0 });
        const twoLines = doc.currentLineHeight(true) * 2 + 0.5;

        if (needed <= maxHeightMulti && needed <= twoLines) {
          return { size, multiline: true, text: value };
        }
      }

      doc.fontSize(s.minValueFont);

      let truncated = value;
      while (truncated.length > 1 && doc.widthOfString(`${truncated}...`) > maxWidth) {
        truncated = truncated.slice(0, -1);
      }

      return {
        size: s.minValueFont,
        multiline: false,
        text: `${truncated.trimEnd()}...`,
      };
    }

    // ── helpers de texto e caixa ────────────────────────────────────────────
    function drawText(x, y, w, h, title, value, opt = {}) {
      const s = { ...style, ...opt };
      x = snap(x); y = snap(y); w = snap(w); h = snap(h);

      doc.font(s.titleBold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(s.titleFont)
        .text(title ?? '', x + s.titleDx, y + s.titleDy, {
          width: w - s.titleDx * 2, align: s.align
        });

      const valueFontName = s.valueBold ? 'Helvetica-Bold' : 'Helvetica';
      const valueText = String(value ?? '');
      const valueWidth = w - s.valueDx * 2;

      if (!s.autoFit) {
        doc.font(valueFontName)
          .fontSize(s.valueFont)
          .text(valueText, x + s.valueDx, y + s.valueDy, {
            width: valueWidth, align: s.align
          });
        return;
      }

      // Área usada quando o valor precisa de 2 linhas: logo abaixo do título
      const multiTop = y + s.titleDy + s.titleFont + 0.5;
      const multiMaxH = (y + h - 1) - multiTop;

      const fit = fitCellValue(
        valueText,
        valueWidth,
        multiMaxH,
        s.valueFont,
        valueFontName,
        s
      );

      doc.font(valueFontName).fontSize(fit.size);

      if (fit.multiline) {
        doc.text(fit.text, x + s.valueDx, multiTop, {
          width: valueWidth,
          height: multiMaxH,
          align: s.align,
          lineGap: 0,
        });
      } else {
        doc.text(fit.text, x + s.valueDx, y + s.valueDy, {
          width: valueWidth,
          align: s.align,
          lineBreak: false,
        });
      }
    }

    // aceita: número (px), 'NN%', '*', '2*'...
    function computeWidths(total, defs, gapX) {
      const nCols = defs.length;

      const totalForCols = total - gapX * (nCols - 1);
      let fixed = 0, pctSum = 0, flexUnits = 0;

      const parts = defs.map(d => {
        if (typeof d === 'number') { fixed += d; return { k: 'fixed', v: d }; }
        if (typeof d === 'string' && d.endsWith('%')) {
          const p = Math.max(0, parseFloat(d)); pctSum += p; return { k: 'pct', v: p };
        }
        const m = String(d).match(/^(\d+)?\*$/);
        const w = m ? Number(m[1] || 1) : 0; flexUnits += w; return { k: 'flex', v: w || 1 };
      });

      const pctPx = (pctSum / 100) * totalForCols;
      let rem = totalForCols - fixed - pctPx; if (rem < 0) rem = 0;

      let widths = parts.map(p => p.k === 'fixed' ? p.v
        : p.k === 'pct' ? (p.v / 100) * totalForCols
          : (flexUnits ? rem * (p.v / flexUnits) : 0));

      const diff = totalForCols - widths.reduce((s, w) => s + w, 0);
      widths[widths.length - 1] += diff;
      return widths.map(snap);
    }

    function drawRow(y, h, widthDefs, cells) {
      const gX = style.gapX;
      const wcols = computeWidths(larguraTabela, widthDefs, gX);

      let col = 0;
      let x = margemX;

      for (const c of cells) {
        const span = Math.max(1, c.span || 1);
        const wColsSum = wcols.slice(col, col + span).reduce((s, a) => s + a, 0);
        const w = wColsSum + gX * (span - 1);

        doc.lineWidth(style.lineWidth)
          .roundedRect(snap(x), snap(y), snap(w), snap(h), style.r)
          .stroke();

        drawText(x, y, w, h, c.title, c.value, c.opt);

        x += w + gX;
        col += span;
      }
    }

    // ── dados/formatadores ─────────────────────
    const transp = infNFe?.transp || {};
    const shipping = orderShipping || {};

    console.log('[DANFE][TRANSP SHIPPING USED]', shipping);

    const volXml = Array.isArray(transp.vol)
      ? (transp.vol[0] || {})
      : (transp.vol || {});

    const transportaXml = transp?.transporta || {};
    const veicXml = transp?.veicTransp || {};

    const clean = (v) => String(v ?? '').trim();

    // Primeiro texto não vazio da lista
    const pick = (...values) => {
      for (const v of values) {
        const s = clean(v);
        if (s) return s;
      }
      return '';
    };

    // Quantidades/pesos: ignora 0 (default da tabela) se houver outro valor > 0
    const pickQty = (...values) => {
      const filled = values
        .map((v) => clean(v))
        .filter((s) => s !== '');

      const positive = filled.find((s) => Number(s) > 0);
      const chosen = positive ?? filled[0] ?? '';

      if (chosen === '') return '';

      const n = Number(chosen);
      return Number.isFinite(n) ? String(n) : chosen;
    };

    const fmtCNPJCPF = (v) => {
      const d = String(v || '').replace(/\D+/g, '');

      if (d.length === 14) {
        return d.replace(
          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
          '$1.$2.$3/$4-$5'
        );
      }

      if (d.length === 11) {
        return d.replace(
          /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
          '$1.$2.$3-$4'
        );
      }

      return v || '';
    };

    const labelModFrete = (code) => {
      const map = {
        '0': '0 - Emitente',
        '1': '1 - Destinatário',
        '2': '2 - Terceiros',
        '3': '3 - Próprio Remet.',
        '4': '4 - Próprio Dest.',
        '9': '9 - Sem Frete',
      };

      const raw = clean(code);
      if (!raw) return '';

      return map[String(Number(raw))] || raw;
    };

    const fmtPlaca = (p = '') =>
      String(p || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

    // Endereço a partir das colunas reais de "budgetsShipping":
    // carrier_address, carrier_number, carrier_complement, carrier_district
    const montarEnderecoTransportadora = (s = {}) => {
      const logradouro = clean(s.carrier_address);
      const numero = clean(s.carrier_number);
      const complemento = clean(s.carrier_complement);
      const bairro = clean(s.carrier_district);

      const partes = [];

      if (logradouro) {
        partes.push(numero ? `${logradouro}, ${numero}` : logradouro);
      } else if (numero) {
        partes.push(numero);
      }

      if (complemento) partes.push(complemento);

      if (bairro && normalizeText(bairro) !== normalizeText(logradouro)) {
        partes.push(bairro);
      }

      return partes.join(' - ').toUpperCase();
    };

    // ── valores exibidos (budgetsShipping → fallback XML) ──────────────────
    const nomeRazao = pick(shipping.carrier_name, transportaXml.xNome);

    const freteTxt = labelModFrete(
      pick(shipping.freight_mode, transp.modFrete)
    );

    const codANTT = pick(
      shipping.vehicle_rntc,
      shipping.antt_code,
      veicXml.RNTC
    );

    const placa = fmtPlaca(pick(shipping.vehicle_plate, veicXml.placa));

    const ufVeiculo = pick(
      shipping.vehicle_state,
      shipping.vehicle_uf,
      veicXml.UF
    ).toUpperCase();

    const docTransp = fmtCNPJCPF(
      pick(shipping.carrier_cnpj_cpf, transportaXml.CNPJ, transportaXml.CPF)
    );

    const endereco = pick(
      montarEnderecoTransportadora(shipping),
      transportaXml.xEnder
    );

    const municipio = pick(shipping.carrier_city, transportaXml.xMun);

    const ufT = pick(
      shipping.carrier_state,
      shipping.carrier_uf,
      transportaXml.UF
    ).toUpperCase();

    const ieTransp = pick(shipping.carrier_ie, transportaXml.IE);

    const qtd = pickQty(shipping.volumes, shipping.volume_quantity, volXml.qVol);
    const especie = pick(shipping.volume_species, volXml.esp);
    const marca = pick(shipping.volume_brand, volXml.marca);
    const numeracao = pick(shipping.volume_numbering, volXml.nVol);
    const pesoB = pickQty(shipping.gross_weight, volXml.pesoB);
    const pesoL = pickQty(shipping.net_weight, volXml.pesoL);

    console.log('[DANFE][TRANSP] valores:', {
      nomeRazao, freteTxt, codANTT, placa, ufVeiculo, docTransp,
      endereco, municipio, ufT, ieTransp, qtd, especie, marca, numeracao, pesoB, pesoL,
    });

    const cellOpt = { titleBold: false, valueBold: true, valueFont: 8 };

    const rowsCfg = [
      {
        h: 22,
        // NOME 240 | FRETE 70 | ANTT 55 | PLACA 75 | UF 20 | CNPJ/CPF 100
        widths: [240, 70, 55, 75, 20, '*'],
        cells: [
          { title: 'NOME / RAZÃO SOCIAL', value: nomeRazao, opt: cellOpt },
          { title: 'FRETE', value: freteTxt, opt: cellOpt },
          { title: 'CÓDIGO ANTT', value: codANTT, opt: cellOpt },
          { title: 'PLACA DO VEÍCULO', value: placa, opt: cellOpt },
          { title: 'UF', value: ufVeiculo, opt: { ...cellOpt, align: 'center' } },
          { title: 'CNPJ / CPF', value: docTransp, opt: cellOpt },
        ],
      },
      {
        h: 22,
        widths: [180, 100, 40, 120, 30, '*'],
        cells: [
          { title: 'ENDEREÇO', value: endereco, span: 3, opt: cellOpt },
          { title: 'MUNICÍPIO', value: municipio, opt: cellOpt },
          { title: 'UF', value: ufT, opt: { ...cellOpt, align: 'center' } },
          { title: 'INSCRIÇÃO ESTADUAL', value: ieTransp, opt: cellOpt },
        ],
      },
      {
        h: 22,
        widths: [60, 120, 100, 100, 60, '*'],
        cells: [
          { title: 'QUANTIDADE', value: qtd, opt: cellOpt },
          { title: 'ESPÉCIE', value: especie, opt: cellOpt },
          { title: 'MARCA', value: marca, opt: cellOpt },
          { title: 'NUMERAÇÃO', value: numeracao, opt: cellOpt },
          { title: 'PESO BRUTO', value: pesoB, opt: cellOpt },
          { title: 'PESO LÍQUIDO', value: pesoL, opt: cellOpt },
        ],
      },
    ];

    doc.lineJoin('round');

    let y = yTransp;

    const titleXTransp = margemX + 6;
    const titleYTransp = yTransp - 7;

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .text(
        'TRANSPORTADOR / VOLUMES TRANSPORTADOS',
        titleXTransp,
        titleYTransp,
        {
          width: 350,
          align: 'left',
        }
      );

    for (let i = 0; i < rowsCfg.length; i++) {
      const r = rowsCfg[i];

      drawRow(y, r.h, r.widths, r.cells);

      y += r.h + style.gapY;
    }

    const totalH =
      rowsCfg.reduce((sum, row) => sum + row.h, 0) +
      style.gapY * (rowsCfg.length - 1);

    yProdutosInicio = yTransp + totalH + 10;
  }

  //=======================================
  //======= Tabela de produtos (modelo DANFE clássico)
  //=======================================
  const ALT_LINHA_PROD = 15;
  const LARGURA_TABELA = 560;

  const colunas = [
    { titulo: 'CÓDIGO PRODUTO', campo: 'cProd', largura: 43 },
    { titulo: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', campo: 'xProd', largura: 180 },
    { titulo: 'NCM/SH', campo: 'NCM', largura: 32 },
    { titulo: 'O/CST', campo: 'CST', largura: 22 },
    { titulo: 'CFOP', campo: 'CFOP', largura: 25 },
    { titulo: 'UN', campo: 'uCom', largura: 22 },
    { titulo: 'QUANT', campo: 'qCom', largura: 30 },
    { titulo: 'VALOR UNIT', campo: 'vUnCom', largura: 38 },
    { titulo: 'VALOR TOTAL', campo: 'vProd', largura: 42 },
    { titulo: 'VALOR DESC', campo: 'vDesc', largura: 22 },
    { titulo: 'B.CÁLC ICMS', campo: 'vBC', largura: 22 },
    { titulo: 'VALOR ICMS', campo: 'vICMS', largura: 22 },
    { titulo: 'VALOR IPI', campo: 'vIPI', largura: 22 },
    { titulo: 'ALÍQ. ICMS', campo: 'pICMS', largura: 20 },
    { titulo: 'ALÍQ. IPI', campo: 'pIPI', largura: 20 },
  ];

  const colXs = (() => {
    const xs = [margemX];
    let x = margemX;
    for (const c of colunas) { x += c.largura; xs.push(x); }
    return xs;
  })();

  let yTabelaTopo = yProdutosInicio + 4;
  let yAtual = yTabelaTopo;

  doc
    .font('Helvetica-Bold')
    .fontSize(6)
    .text('DADOS DOS PRODUTOS / SERVIÇOS', margemX + 2, yTabelaTopo - 10, {
      width: 300,
      align: 'left',
    });

  //=========================
  // Cabeçalho
  //=========================
  const raio = 3;
  doc.lineWidth(0.5);

  doc.roundedRect(margemX, yAtual, LARGURA_TABELA, ALT_LINHA_PROD, raio).stroke();

  doc.undash();
  for (let i = 1; i < colXs.length - 1; i++) {
    doc.moveTo(colXs[i], yAtual).lineTo(colXs[i], yAtual + ALT_LINHA_PROD).stroke();
  }

  doc.font('Helvetica-Bold').fontSize(5);
  for (let i = 0; i < colunas.length; i++) {
    const col = colunas[i];
    const x0 = colXs[i];
    doc.text(
      String(col.titulo).replace(' / ', '\n'),
      x0 + 2,
      yAtual + 4,
      { width: col.largura - 4, align: 'left' }
    );
  }

  yAtual += ALT_LINHA_PROD;

  //=======================================================================================
  // TABELA PRODUTOS - Sem caixas por célula - Divisórias verticais tracejadas
  //=======================================================================================
  doc.font('Helvetica').fontSize(6);
  const COLS_NUMERICAS = new Set(['qCom', 'vUnCom', 'vProd', 'vDesc', 'vBC', 'pICMS', 'vICMS', 'pIPI', 'vIPI']);

  let alturaMaxArea = doc.page.height - 40 - yAtual;
  const yCorpoTopo = yAtual;

  aplicarMarcaDAguaProdutos(doc, {
    x: margemX,
    y: yCorpoTopo,
    w: LARGURA_TABELA,
    h: alturaMaxArea
  });

  function parseNumNFe(v) {
    if (v === null || v === undefined) return 0;
    let s = String(v).trim();
    if (!s) return 0;

    s = s.replace(/\s+/g, '');
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');

    if (hasDot && hasComma) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      s = s.replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function fmtFixed(n, casas = 2) {
    try { return Number(n).toFixed(casas); }
    catch { return (0).toFixed(casas); }
  }

  (itensDet || []).forEach((item, itemIndex) => {
    const prod = item?.prod || {};

    const icmsObj = item?.imposto?.ICMS || {};
    const icmsKey = Object.keys(icmsObj || {})[0] || '';
    const icms = (icmsObj && icmsObj[icmsKey]) || {};

    const vBC = parseNumNFe(icms.vBC);
    const pICMS = parseNumNFe(icms.pICMS ?? icms.pICMSST);
    const vICMS = parseNumNFe(icms.vICMS ?? icms.vICMSST);

    const IPI = item?.imposto?.IPI || {};
    const IPITrib = IPI?.IPITrib || {};
    const pIPI = parseNumNFe(IPITrib?.pIPI);
    const vIPI = parseNumNFe(IPITrib?.vIPI);

    const qCom = parseNumNFe(prod.qCom);
    const vUnCom = parseNumNFe(prod.vUnCom);
    const vProd = parseNumNFe(prod.vProd);
    const vDesc = parseNumNFe(prod.vDesc);

    // Origem + CST → coluna "O/CST"
    const origem = (icms.orig ?? '0').toString();
    const cstCode = icms.CST || icms.CSOSN || '';
    const oCst = `${origem}/${cstCode}`;

    console.log('[DANFE][UNIT_CHECK]', {
      sku: prod.cProd,
      xml_uCom: prod.uCom,
      xml_uTrib: prod.uTrib,
      orderItem: findOrderItemMatch(prod, orderItems, itemIndex),
      finalUnit: resolveDanfeUnit(prod, orderItems, itemIndex),
    });

    const linha = {
      cProd: prod.cProd || '',
      xProd: prod.xProd || '',
      NCM: prod.NCM || '',
      CST: oCst,
      CFOP: prod.CFOP || '',
      uCom: resolveDanfeUnit(prod, orderItems, itemIndex),
      qCom: fmtFixed(qCom, 3),
      vUnCom: fmtFixed(vUnCom, 4),
      vProd: fmtFixed(vProd, 2),
      vDesc: fmtFixed(vDesc, 2),
      vBC: fmtFixed(vBC, 2),
      pICMS: fmtFixed(pICMS, 2),
      vICMS: fmtFixed(vICMS, 2),
      pIPI: fmtFixed(pIPI, 2),
      vIPI: fmtFixed(vIPI, 2),
    };

    // Quebra de página simples
    if (yAtual + ALT_LINHA_PROD > yCorpoTopo + alturaMaxArea) {
      const alturaUsada = yAtual - yTabelaTopo;
      doc.roundedRect(margemX, yTabelaTopo, LARGURA_TABELA, alturaUsada, raio).stroke();

      stampDocumentStatusOnTop();

      doc.addPage();
      yTabelaTopo = 40;
      yAtual = yTabelaTopo;

      // Cabeçalho da tabela na nova página
      doc.roundedRect(margemX, yAtual, LARGURA_TABELA, ALT_LINHA_PROD, raio).stroke();
      doc.undash();
      for (let i = 1; i < colXs.length - 1; i++) {
        doc.moveTo(colXs[i], yAtual).lineTo(colXs[i], yAtual + ALT_LINHA_PROD).stroke();
      }
      doc.font('Helvetica-Bold').fontSize(5);
      for (let i = 0; i < colunas.length; i++) {
        const col = colunas[i];
        const x0 = colXs[i];
        doc.text(
          String(col.titulo).replace(' / ', '\n'),
          x0 + 2,
          yAtual + 4,
          { width: col.largura - 4, align: 'left' }
        );
      }
      yAtual += ALT_LINHA_PROD;

      alturaMaxArea = doc.page.height - 40 - yAtual;
      const yCorpoTopoNova = yAtual;

      aplicarMarcaDAguaProdutos(doc, {
        x: margemX,
        y: yCorpoTopoNova,
        w: LARGURA_TABELA,
        h: alturaMaxArea
      });

      doc.font('Helvetica').fontSize(6);
    }

    // Divisórias verticais tracejadas para ESTA linha
    doc.lineWidth(0.3).dash(1.5, { space: 2 });
    for (let i = 1; i < colXs.length - 1; i++) {
      doc.moveTo(colXs[i], yAtual).lineTo(colXs[i], yAtual + ALT_LINHA_PROD).stroke();
    }
    doc.undash();

    // Textos da linha
    for (let i = 0; i < colunas.length; i++) {
      const col = colunas[i];
      const x0 = colXs[i];
      const texto = String(linha[col.campo] ?? '');
      const eNumero = COLS_NUMERICAS.has(col.campo);

      doc.text(texto, x0 + 2, yAtual + 6, {
        width: col.largura - 4,
        align: eNumero ? 'right' : 'left'
      });
    }

    // linha horizontal tracejada na base da linha
    doc.lineWidth(0.3).dash(1.5, { space: 2 });
    doc.moveTo(margemX, yAtual + ALT_LINHA_PROD)
      .lineTo(margemX + LARGURA_TABELA, yAtual + ALT_LINHA_PROD)
      .stroke();
    doc.undash();

    yAtual += ALT_LINHA_PROD;
  });

  // =========================
  // ► Fecha TABELA e desenha "DADOS ADICIONAIS" (2 caixas)
  // =========================
  (function closeProductsAndDrawInfo() {
    const MARGEM_INFERIOR = 40;
    const ESPACO_ENTRE = 8;
    const ALTURA_MIN = 40;
    const larguraFisco = 180;
    const gapBoxes = 8;
    const raioInfo = 3;

    const infAdOriginal = String(
      complementaryInfo ??
      infNFe?.infAdic?.infCpl ??
      ''
    ).trim();

    // remove linhas de pagamento / duplicatas para não poluir o quadro
    const infAdSemPagamento = removePaymentInfoFromInfCpl(infAdOriginal);

    const blocos = [];

    if (infAdSemPagamento) {
      blocos.push(infAdSemPagamento);
    }

    const numeroFatura = String(
      fatura?.numero ??
      infNFe?.cobr?.fat?.nFat ??
      ''
    ).trim();

    if (numeroFatura) {
      blocos.push(`Fatura: ${numeroFatura}`);
    }

    // Informações de ICMS-ST geradas a partir do XML autorizado
    const formatMoneyBRComplete = (value) =>
      Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const detalhesIcmsSt = asArray(itensDet)
      .map((item) => {
        const prod = item?.prod || {};
        const icmsGroup = item?.imposto?.ICMS || {};

        const icmsKey = Object.keys(icmsGroup)[0];
        const icms = icmsKey ? icmsGroup[icmsKey] : {};

        const cst = String(
          icms?.CST ??
          icms?.CSOSN ??
          ''
        ).padStart(2, '0');

        // CST 60 = ICMS cobrado anteriormente por substituição tributária
        if (cst !== '60') {
          return null;
        }

        const baseStAnterior = parseNumNFe(
          icms?.vBCSTRet ??
          icms?.vBCST
        );

        const valorStAnterior = parseNumNFe(
          icms?.vICMSSTRet ??
          icms?.vST
        );

        if (baseStAnterior <= 0 && valorStAnterior <= 0) {
          return null;
        }

        const codigoProduto = String(
          prod?.cProd || ''
        ).trim();

        return [
          `CodProd: ${codigoProduto || '—'}`,
          `Base ST Ant.: ${formatMoneyBRComplete(baseStAnterior)}`,
          `Valor ST Ant.: ${formatMoneyBRComplete(valorStAnterior)}`,
        ].join(' / ');
      })
      .filter(Boolean);

    // Evita duplicar o bloco de ICMS-ST quando ele já está no infCpl
    const infAdNormalizado = normalizeText(infAdSemPagamento);
    const jaPossuiInformacaoIcmsSt =
      infAdNormalizado.includes('IMPOSTO RECOLHIDO POR ST') &&
      infAdNormalizado.includes('ANEXO VII DO RICMS/2023');

    if (detalhesIcmsSt.length && !jaPossuiInformacaoIcmsSt) {
      blocos.push(
        [
          'Imposto recolhido por ST nos termos do Anexo VII do RICMS/2023, Decreto nº 48.589.',
          ...detalhesIcmsSt,
        ].join(' ')
      );
    }

    const infAdFinal = blocos.join('\n').trim() || '—';

    console.log('[DANFE][DADOS ADICIONAIS]', {
      infAdOriginal,
      infAdSemPagamento,
      detalhesIcmsSt,
      infAdFinal,
    });

    const xLeft = margemX;
    const wLeft = LARGURA_TABELA - larguraFisco - gapBoxes;

    doc.font('Helvetica').fontSize(7);
    const textH = doc.heightOfString(infAdFinal, {
      width: wLeft - 16,
    });

    const EXTRA_H = 26;
    const hInfoNeed = Math.max(ALTURA_MIN, textH + EXTRA_H);

    const MAX_ALTURA_INFO = 90;

    const hInfo = Math.min(
      Math.max(hInfoNeed, ALTURA_MIN),
      MAX_ALTURA_INFO
    );

    const yBottomLimit = doc.page.height - MARGEM_INFERIOR;

    let yInfoTop = yBottomLimit - hInfo;

    // Se a tabela invadir o espaço reservado, fecha a tabela nesta página
    // e coloca DADOS ADICIONAIS no rodapé de uma nova página.
    if (yAtual + ESPACO_ENTRE > yInfoTop - 7) {
      const currentTableHeight = Math.max(
        ALT_LINHA_PROD,
        yAtual - yTabelaTopo
      );

      doc
        .undash()
        .lineWidth(0.3)
        .roundedRect(
          margemX,
          yTabelaTopo,
          LARGURA_TABELA,
          currentTableHeight,
          raio
        )
        .stroke();

      stampDocumentStatusOnTop();
      doc.addPage();

      yInfoTop =
        doc.page.height -
        MARGEM_INFERIOR -
        hInfo;
    } else {
      const productsTableHeight = Math.max(
        ALT_LINHA_PROD,
        yAtual - yTabelaTopo
      );

      doc
        .undash()
        .lineWidth(0.3)
        .roundedRect(
          margemX,
          yTabelaTopo,
          LARGURA_TABELA,
          productsTableHeight,
          raio
        )
        .stroke();
    }

    const xRight = xLeft + wLeft + gapBoxes;

    // título geral
    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .text('DADOS ADICIONAIS', margemX, yInfoTop - 7);

    // caixa esquerda
    doc
      .save()
      .fillColor('white')
      .roundedRect(xLeft, yInfoTop, wLeft, hInfo, raioInfo)
      .fill()
      .restore();

    doc
      .lineWidth(0.3)
      .roundedRect(xLeft, yInfoTop, wLeft, hInfo, raioInfo)
      .stroke();

    const legendTxt = 'INFORMAÇÕES COMPLEMENTARES';
    doc.font('Helvetica-Bold').fontSize(7);

    const legendPadX = 5;
    const legendPadY = 2;
    const legendH = 12;
    const legendW = doc.widthOfString(legendTxt) + legendPadX * 2;
    const legendX = xLeft + 1;
    const legendY = yInfoTop + 2;

    doc
      .save()
      .fillColor('white')
      .rect(legendX, legendY, legendW, legendH)
      .fill()
      .restore();

    doc.text(legendTxt, legendX + legendPadX, legendY + legendPadY);

    // texto interno
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(infAdFinal, xLeft + 8, yInfoTop + 18, {
        width: wLeft - 16,
        height: Math.max(10, hInfo - 22),
        align: 'left',
      });

    // caixa direita
    doc
      .save()
      .fillColor('white')
      .roundedRect(xRight, yInfoTop, larguraFisco, hInfo, raioInfo)
      .fill()
      .restore();

    doc
      .lineWidth(0.3)
      .roundedRect(xRight, yInfoTop, larguraFisco, hInfo, raioInfo)
      .stroke();

    const legendFisco = 'RESERVADO AO FISCO';
    doc.font('Helvetica-Bold').fontSize(7);

    const legendFiscoW = doc.widthOfString(legendFisco) + legendPadX * 2;
    const legendFiscoX = xRight + 1;
    const legendFiscoY = yInfoTop + 2;

    doc
      .save()
      .fillColor('white')
      .rect(legendFiscoX, legendFiscoY, legendFiscoW, legendH)
      .fill()
      .restore();

    doc.text(
      legendFisco,
      legendFiscoX + legendPadX,
      legendFiscoY + legendPadY
    );

    // ================================================================
    // QUADRO CONSART ERP
    // Apenas elemento visual: não altera margens, paginação ou blocos
    // existentes do DANFE.
    // ================================================================
    {
      const consartBoxW = 560;
      const consartBoxH = 22;
      const consartBoxX = margemX + (LARGURA_TABELA - consartBoxW) / 2;
      const consartBoxY = yInfoTop + hInfo + 2;

      const consartLogoPath = path.join(
        __dirname,
        '../public/imagens/logoConsart3D.png'
      );

      doc
        .save()
        .fillColor('white')
        .roundedRect(consartBoxX, consartBoxY, consartBoxW, consartBoxH, 3)
        .fill()
        .restore();

      doc
        .lineWidth(0.3)
        .roundedRect(consartBoxX, consartBoxY, consartBoxW, consartBoxH, 3)
        .stroke();

      let consartTextX = consartBoxX + 8;
      let consartTextW = consartBoxW - 16;

      if (fs.existsSync(consartLogoPath)) {
        const logoW = 56;
        const logoH = 68;
        const logoX = consartBoxX + 7;
        const logoY = consartBoxY + (consartBoxH - logoH) / 2;

        doc.image(consartLogoPath, logoX, logoY, {
          width: 70,
          height: 70,
        });
      }

      const titleX = consartBoxX + 100;
      const titleY = consartBoxY + 2;
      doc
        .font('Helvetica-Bold')
        .fontSize(5)
        .text(
          'CONSART Soluções Empresariais',
          titleX,
          titleY,
          {
            width: 180,
            lineBreak: false,
          }
        );

      const contactX = consartBoxX + 100;
      const contactY = consartBoxY + 9;
      doc
        .font('Helvetica')
        .fontSize(4)
        .text(
          'Contato@consart.com.br / (31) 9 8923-0220',
          contactX,
          contactY,
          {
            width: 200,
            lineBreak: false,
          }
        );

      const adressX = consartBoxX + 100;
      const adressY = consartBoxY + 13;
      doc
        .font('Helvetica')
        .fontSize(4)
        .text(
          'Rua Desembargador Jorge Fontana 476, Belvedere',
          adressX,
          adressY,
          {
            width: 200,
            lineBreak: false,
          }
        );
    }


  })();

  // ✅ carimbo por cima também na última página
  // (a chamada estava dentro do comentário: DANFE de 1 página nunca recebia a marca d'água)
  stampDocumentStatusOnTop();

  doc.end();

  const buffer = await bufferPromise;

  return {
    buffer,
    filename: nomePDF,
    chaveAcesso: chaveBarRaw || null,
  };
}