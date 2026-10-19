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
import { fileURLToPath } from 'node:url';   // 👈 ADICIONE ESTA LINHA

// 👇 BLOCO NOVO PARA ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 👆 Agora __dirname passa a existir neste módulo

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

// ======================================================================
// Helpers básicos
// ======================================================================
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
    const watermarkPath = path.join(
      __dirname,
      '../../backend/public/imagens/logoconsart.png'
    );

    if (!fs.existsSync(watermarkPath)) {
      console.warn('[DANFE] Marca d’água PRODUTOS: arquivo não encontrado em', watermarkPath);
      return;
    }

    const wmWidth  = w * 0.4;
    const wmHeight = h * 0.6;

    const xCenter = x + (w - wmWidth) / 2;

    // 🔼 Sobe um pouco a logo dentro do bloco de produtos
    const offsetY   = 30; // ajuste fino – pode aumentar/diminuir
    let yCenter = y + (h - wmHeight) / 2 - offsetY;

    // garante que não passe da borda de cima do bloco
    yCenter = Math.max(y + 4, yCenter);

    doc.save();
    doc.opacity(0.2);

    doc.image(watermarkPath, xCenter, yCenter, {
      width: wmWidth,
      height: wmHeight,
    });

    doc.opacity(1);
    doc.restore();
  } catch (e) {
    console.error('[DANFE] Erro ao aplicar marca d’água em PRODUTOS:', e);
  }
}

// ──────────────────────────────────────────────────────────────
// Extrai FATURA / DUPLICATAS do XML (prioriza <cobr>, cai para <pag/detPag>)
// Compatível com xml2js { explicitArray: false }
// ──────────────────────────────────────────────────────────────
function extractFaturaFromInfNFe(rootInfNFe = {}) {
  const toArr = (v) => (Array.isArray(v) ? v : (v != null ? [v] : []));
  let fatura = null;
  let duplicatas = [];
  let formasPagamento = [];

  const mapTipoPagamento = (tPagRaw) => {
    const t = String(tPagRaw ?? '').padStart(2, '0');
    const mapa = {
      '01': 'Dinheiro',
      '02': 'Cheque',
      '03': 'Cartão de Crédito',
      '04': 'Cartão de Débito',
      '05': 'Crédito Loja',
      '10': 'Vale Alimentação',
      '11': 'Vale Refeição',
      '12': 'Vale Presente',
      '13': 'Vale Combustível',
      '14': 'Duplicata Mercantil',
      '15': 'Boleto Bancário',
      '16': 'Depósito Bancário',
      '17': 'PIX',
      '18': 'Transferência Bancária',
      '19': 'Programa de Fidelidade',
      '90': 'Sem Pagamento',
      '99': 'Outros'
    };
    return mapa[t] || `Tipo ${t}`;
  };

  const money = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // 1) Tenta achar <cobr> em qualquer nível dentro de infNFe
  const cobr = findByKey(rootInfNFe, 'cobr');

  if (cobr) {
    const fatNode = cobr.fat;
    if (fatNode) {
      const fat = Array.isArray(fatNode) ? fatNode[0] : fatNode;
      fatura = {
        numero:        fat.nFat  ?? null,
        valorOriginal: fat.vOrig != null ? Number(fat.vOrig) : null,
        valorLiquido:  fat.vLiq  != null ? Number(fat.vLiq)  : null,
      };
    }

    const dupNode  = cobr.dup;
    const dupList  = toArr(dupNode);

    duplicatas = dupList.map((d, idx) => ({
      numero:      d.nDup ?? String(idx + 1).padStart(3, '0'),
      vencimento:  d.dVenc || null,
      valor:       d.vDup != null ? Number(d.vDup) : null,
    }));

    console.log('[DANFE] COBRANCA <cobr> encontrada:', { fatura, duplicatas });
  }

  // 2) FORMAS DE PAGAMENTO: <pag><detPag>
  const pag = findByKey(rootInfNFe, 'pag');
  const rawDet = pag?.detPag;
  const detPag = toArr(rawDet);

  if (detPag.length) {
    formasPagamento = detPag.map((p) => {
      const tipo = mapTipoPagamento(p.tPag);
      const valorNum = Number(p.vPag ?? 0);
      return {
        tipo,
        tPag: p.tPag,
        valor: valorNum,
        valorFmt: money(valorNum),
        bandeira: p.card?.CNPJ || p.card?.tBand || null,
        autorizacao: p.card?.cAut || null,
        vencimento: p.dVenc || null,
      };
    });

    // Se NÃO tinha <cobr>, monta fatura simples a partir da soma dos detPag
    if (!fatura) {
      const total = detPag.reduce(
        (s, p) => s + Number(p.vPag ?? 0),
        0,
      );
      fatura = {
        numero:        null,
        valorOriginal: total,
        valorLiquido:  total,
      };
    }
  }

  return { fatura, duplicatas, formasPagamento };
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
} = {}) {
  console.log('🧩 generateDanfeFromXml params:', {
    numero,
    serie,
    hasXmlContent: !!xmlContent,
    chave: String(chave || '').slice(0, 8) +
      (String(chave || '').length ? '…' : ''),
    xmlFile,
  });

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
  const { fatura, duplicatas, formasPagamento } = extractFaturaFromInfNFe(infNFe);
  console.log('[DANFE] Fatura extraída:', fatura);
  console.log('[DANFE] Duplicatas extraídas:', duplicatas);
  console.log('[DANFE] Formas de pagamento extraídas:', formasPagamento);
  
// Monta texto de DUPLICATAS / PAGAMENTO para usar em "Informações Complementares"
let duplicatasInfoText = null;
let paymentInfoText = null;

// helper de dinheiro
const moneyText = (v) =>
  Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// 1) Preferir DUPLICATAS (cobr.dup)
if (duplicatas && duplicatas.length) {
  const linhas = duplicatas.map((dup, idx) => {
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

// 2) Se não tiver duplicatas, cai para formas de pagamento / texto manual
if (!duplicatasInfoText) {
  if (paymentText && String(paymentText).trim()) {
    paymentInfoText = String(paymentText).trim();
  } else if (formasPagamento && formasPagamento.length) {
    const partes = formasPagamento.map(
      (fp) => `${fp.tipo} – R$ ${fp.valorFmt}`,
    );
    paymentInfoText = `FORMA DE PAGAMENTO: ${partes.join(' | ')}`;
  }
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

// 🔥 CANCELAMENTO: força por DB e faz fallback pelo XML
const statusDb = String(
  prot?.status || prot?.nfe_status || prot?.nfeStatus || prot?.situacao || ''
).toLowerCase();

const canceladaForcadaDb =
  statusDb.includes('cancel') || statusDb.includes('cancela') || statusDb.includes('101');

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
function stampCancelOnTop() {
  if (!cancelada) return;
  aplicarMarcaDAguaCancelado(doc);
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
  //  🔽🔽🔽  A PARTIR DAQUI É TODA A PARTE DE LAYOUT QUE VOCÊ JÁ TINHA 🔽🔽🔽
  //  (copiei do seu arquivo, apenas removendo a gravação em disco)
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

  const textoCanhoto = `RECEBEMOS DE ${
    emit?.xNome || '---'
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
  const nNfRaw   = ide?.nNF;
  const nNf      = nNfRaw ? String(nNfRaw).padStart(9, '0') : '000000000';
  const nNfFmt   = nNf.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');

  const serieRaw = ide?.serie;
  const serieFmt = serieRaw ? String(serieRaw).padStart(3, '0') : '001';

  // Moldura do quadro
  doc
    .lineWidth(0.3)
    .roundedRect(posXNFE, posYNFE, larguraQuadroNFE, alturaQuadroNFE, 3)
    .stroke();

  // Título NF-e (um pouco mais pra cima)
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('NF-e', posXNFE, posYNFE + 4, {
      width: larguraQuadroNFE,
      align: 'center',
    });

  // Número e Série (subidos levemente)
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
const boxEmit = { x: margemX, y: 58, w: 220, h: 90 }; // mesma base para tudo

// Moldura arredondada (igual aos outros campos)
doc
  .lineWidth(0.3)
  .roundedRect(boxEmit.x, boxEmit.y, boxEmit.w, boxEmit.h, 3)
  .stroke();

// Título "IDENTIFICAÇÃO DO EMITENTE" maior e centralizado
doc
  .font('Helvetica-Bold')
  .fontSize(7) // maiorzinho
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
const LOGO_MAX_W = 100;  // largura máx.
const LOGO_MAX_H = 80;   // altura máx.

// Posição da logo (esquerda dentro do quadro)
const logoX = boxEmit.x + 2;
const logoY = boxEmit.y + 8; // desce um pouco por causa do título

// Se existir arquivo, desenha a logo
let deslocamentoTextoX = 0;
if (fs.existsSync(logoPath)) {
  doc.image(logoPath, logoX, logoY, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
  deslocamentoTextoX = LOGO_MAX_W + 16; // espaço para a logo + respiro
}

// Posição/área disponível para os textos (à direita da logo)
const infoX = boxEmit.x + 5 + deslocamentoTextoX;
const infoW = boxEmit.w - deslocamentoTextoX - 10;

// Dados do emitente
const endEmit = emit?.enderEmit || {};

// Monta o texto completo em 4 linhas
const linha1 = (emit.xNome || '---').toUpperCase();
const linha2 = `${endEmit.xLgr || ''}, ${endEmit.nro || ''}`.trim();
const linha3 = `${(endEmit.xBairro || '').toUpperCase()} - CEP: ${fmtCEP(
  endEmit.CEP || ''
)}`;
const fone   = endEmit.fone ? ` Fone: ${endEmit.fone}` : '';
const linha4 = `${(endEmit.xMun || '').toUpperCase()} - ${(endEmit.UF || '')
  .toUpperCase()}${fone}`;

const emitenteTexto = [linha1, linha2, linha3, linha4]
  .filter(Boolean)
  .join('\n');

// Posição do bloco de texto (abaixo do título, centralizado)
const textoX = infoX;
const textoY = boxEmit.y + 26; // logo depois do título
const textoW = infoW;

// Fonte maior + texto centralizado
doc
  .font('Helvetica-Bold')
  .fontSize(6)
  .text(emitenteTexto, textoX, textoY, {
    width: textoW,
    align: 'center',
  });

  // Moldura “DANFE” — NOVO PADRÃO (0-ENTRADA / 1-SAÍDA + NF-e 9 dígitos)
  {
    const x = margemX + 220;
    const y = 58;
    const w = 90;
    const h = 90;

    // Quadro externo
    doc.lineWidth(0.3).roundedRect(x, y, w, h, 4).stroke();

    // Título DANFE
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .text('DANFE', x, y + 3, { width: w, align: 'center' });

    // Subtítulo
    doc.font('Helvetica')
       .fontSize(6)
       .text('Documento Auxiliar da Nota', x, y + 17, { width: w, align: 'center' })
       .text('Fiscal Eletrônica',          x, y + 27, { width: w, align: 'center' });

    // 0 = ENTRADA / 1 = SAÍDA
    const indEntradaSaida = String(ide?.tpNF ?? '1'); // padrão saída

    doc.font('Helvetica')
       .fontSize(6)
       .text('0 - ENTRADA', x + 5, y + 40)
       .text('1 - SAÍDA',   x + 5, y + 50);

    // Caixinha com o número (0 ou 1)
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

    // Número da NF-e com 9 dígitos (000.000.000)
    const nNfRaw = ide?.nNF;
    const nNf = nNfRaw ? String(nNfRaw).padStart(9, '0') : '000000000';
    const nNfFmt = nNf.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');

    // Série com 3 dígitos
    const serieRaw = ide?.serie;
    const serieFmt = serieRaw ? String(serieRaw).padStart(3, '0') : '001';

    doc.font('Helvetica-Bold')
       .fontSize(8)
       .text(`Nº. ${nNfFmt}`, x, y + 60, { width: w, align: 'center' })
       .text(`Série ${serieFmt}`, x, y + 70, { width: w, align: 'center' });

    // Folha
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
    // === helpers locais / estilo ===
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

    // arredondamento fino para evitar "meio pixel"
    const snap = v => Math.round(v * 10) / 10;

    // garante que todos os campos terminem exatamente na mesma coluna final
    const RIGHT = snap(margemX + larguraTotal);

    function field(x, y, w, h, title, value, opt = {}) {
      const s = { ...style, ...opt };
      x = snap(x); y = snap(y); w = snap(w); h = snap(h);
      doc.lineWidth(s.lineWidth).roundedRect(x, y, w, h, s.r).stroke();
      doc.font(s.titleBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(s.titleFont)
         .text(title, x + s.titleDx, y + s.titleDy, { width: w - s.titleDx*2, align: s.align });
      doc.font(s.valueBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(s.valueFont)
         .text(value, x + s.valueDx, y + s.valueDy, { width: w - s.valueDx*2, align: s.align });
    }

    // desenha uma linha de campos; a ÚLTIMA coluna fecha na borda direita (RIGHT)
    function row(x, y, h, cols) {
      let cx = snap(x);
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        const w = snap(c.w); // sempre usa o valor informado
        field(cx, y, w, h, c.title, c.value, c.opt || {});
        cx = snap(cx + w);
      }
    }

    // === formatadores ===
    const fmt = (v, def='—') => (String(v ?? '').trim() || def);
    const soData = (iso)=>{ if(!iso) return '—'; const d=String(iso).split('T')[0]||''; const [Y,M,D]=d.split('-'); return (D&&M&&Y)?`${D}/${M}/${Y}`:'—'; };
    const soHora = (iso)=>{ const t=(String(iso).split('T')[1]||''); return t ? t.substring(0,8) : ''; };
    const fmtCNPJCPF = (v)=>{ const d=String(v||'').replace(/\D+/g,''); 
      if (d.length===14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
      if (d.length===11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
      return fmt(v);
    };

    // === valores ===
    const natureza = fmt(naturezaOperacao);
    const protNum  = fmt(prot?.nProt || '');
    const protData = soData(prot?.dhRecbto || '');
    const protHora = soHora(prot?.dhRecbto || '');
    const protocoloTxt = protNum ? `${protNum}  -  ${protData} ${protHora}` : '';

    const emitIE   = fmt(infNFe?.emit?.IE);
    const emitIM   = fmt(infNFe?.emit?.IM);
    const emitIEST = fmt(infNFe?.emit?.IEST);
    const emitDoc  = fmtCNPJCPF(infNFe?.emit?.CNPJ || infNFe?.emit?.CPF);

    // === geometria (posiciona logo abaixo da seção de barras/consulta) ===
    const yTop = 150;   // ajuste fino se precisar subir/baixar
    const H1   = 24;    // altura 1ª linha
    const H2   = 22;    // altura 2ª linha

    //================
    // === LINHA 1 ===
    //================
    row(margemX, yTop, H1, [
      { w: 380, title: 'NATUREZA DA OPERAÇÃO', value: natureza,
        opt: { valueFont: 6, valueBold: true } },
        { w: 180, title: 'PROTOCOLO DE AUTORIZAÇÃO DE USO', value: protocoloTxt,
          opt: { valueFont: 8, valueBold: true } } // 👈 was 11
        ]);

    //====================================================================================
    // === LINHA 2 === (IE | IM | IEST | CNPJ/CPF) – a soma precisa fechar larguraTotal===
    //====================================================================================
    const y2 = yTop + H1;

    row(margemX, y2, H2, [
      { w: 180, title: 'INSCRIÇÃO ESTADUAL',                     value: emitIE },
      { w: 130, title: 'INSCRIÇÃO MUNICIPAL',                    value: emitIM },
      { w: 150, title: 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.',   value: emitIEST },
      { w: 100, title: 'CNPJ / CPF',                            value: emitDoc }
    ]);
  }

// ==============================================================================================
// ============ DESTINATÁRIO / REMETENTE – PARAM POR CAMPO (COLUNAS FIXADAS POR VOCÊ) ===========
// ==============================================================================================
(function renderDestinatario() {
  // --- helpers ---
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
      .text(title, x + s.titleDx, y + s.titleDy, {
        width: w - s.titleDx * 2,
        align: s.align,
      });

    docRef
      .font(s.valueBold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(s.valueFont)
      .text(value, x + s.valueDx, y + s.valueDy, {
        width: w - s.valueDx * 2,
        align: s.align,
      });
  }

  const endDest = dest?.enderDest || dest?.ender || {};
  const fmt = (v, def = '—') => String(v ?? '').trim() || def;
  const fmtCEP = (cep = '') => {
    const d = soNum(cep);
    return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, '$1-$2') : fmt(cep);
  };
  const fmtCNPJCPF = (v) => {
    const d = soNum(v || '');
    if (d.length === 14)
      return d.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        '$1.$2.$3/$4-$5',
      );
    if (d.length === 11)
      return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return fmt(v);
  };
  const fmtFone = (v) => {
    const d = soNum(v || '');
    if (d.length === 10)
      return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    if (d.length === 11)
      return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
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

  const VAL = {
    nome: fmt((dest?.xNome || '').toUpperCase()),
    cnpjCpf: fmtCNPJCPF(dest?.CNPJ || dest?.CPF),
    dataEmi: soData(ide?.dhEmi || ide?.dEmi || ''),

    endereco: fmt(
      (endDest?.xLgr || '').toUpperCase() +
        (endDest?.nro ? `, ${String(endDest.nro).toUpperCase()}` : ''),
    ),
    bairro: fmt((endDest?.xBairro || '-').toUpperCase()),
    cep: fmtCEP(endDest?.CEP),
    dataSai:
      soData(ide?.dhSaiEnt || ide?.dSaiEnt || '') ||
      soData(ide?.dhEmi || ide?.dEmi || ''),

    municipio: fmt((endDest?.xMun || '').toUpperCase()),
    uf: fmt((endDest?.UF || '').toUpperCase(), ' '),
    fone: fmtFone(endDest?.fone),
    ie: fmt(dest?.IE),
    horaSai:
      soHora(ide?.dhSaiEnt || ide?.dSaiEnt || '') ||
      soHora(ide?.dhEmi || ide?.dEmi || ''),
  };

  const cfgDest = {
    xStart: margemX,
    // 👇 Desci um pouco o bloco para abrir espaço pro título
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
            value: VAL.horaSai || '—',
            width: 95,
            style: { valueFont: 7, align: 'center' },
          },
        ],
      },
    ],
  };

  // ──────────────────────────────────────────────────────────────
  // TÍTULO DO BLOCO (colado na borda esquerda do primeiro campo)
  // ──────────────────────────────────────────────────────────────
  const titleX = cfgDest.xStart + 6;      // mesmo recuo dos outros títulos
  const titleY = cfgDest.yStart - 7;      // encostado na borda superior do bloco

  doc
    .font('Helvetica-Bold')
    .fontSize(6)
    .text('DESTINATÁRIO / REMETENTE', titleX, titleY, {
      width: 350,
      align: 'left',
    });

  // ──────────────────────────────────────────────────────────────
  // Renderização das linhas/campos
  // ──────────────────────────────────────────────────────────────
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
// (apenas cards de duplicatas – sem quadro externo, mais “compacto”)
const yFatura           = 282;  // posição vertical
const alturaQuadroDup   = 34;
const alturaLinhaFatura = 22;   // ainda usado na seção de IMPOSTOS

{
  // 👉 mesma largura do bloco "CÁLCULO DO IMPOSTO" / tabela de produtos
  const larguraQuadroDup = 560;      // antes: larguraTotal (545)
  const xBase = margemX;

  // helper de dinheiro
  const money = (v) =>
    Number(v || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Título “DUPLICATAS”
  doc
    .font('Helvetica-Bold')
    .fontSize(6)
    .text('DUPLICATAS', xBase + 2, yFatura + 1);

  const listaDup = Array.isArray(duplicatas) ? duplicatas : [];
  const maxMostrar = Math.min(4, Math.max(1, listaDup.length || 1)); // até 4 cards

  // 👉 agora os cards vão de borda a borda
  const paddingHorizontal = 0;   // antes: 6
  const gap = 4;                 // espaço entre cards (pode ajustar se quiser)
  const areaUtil = larguraQuadroDup - paddingHorizontal * 2;

  const larguraCard =
    maxMostrar > 0
      ? (areaUtil - gap * (maxMostrar - 1)) / maxMostrar
      : areaUtil;

  const cardAltura  = alturaQuadroDup - 10;
  const baseYCards  = yFatura + 8;

  doc.font('Helvetica').fontSize(6);

  for (let i = 0; i < maxMostrar; i++) {
    const dup = listaDup[i] || {};
    const num = dup.numero || String(i + 1).padStart(3, '0');

    const dVencRaw = dup.vencimento || dup.dVenc || null;
    const dVenc = dVencRaw
      ? String(dVencRaw).split('T')[0].split('-').reverse().join('/')
      : '—';

    const vDupNum = dup.valor ?? dup.vDup ?? 0;
    const vDupFmt = money(vDupNum);

    // cards ocupando a largura toda, proporcionais ao nº de parcelas
    const xCard = xBase + paddingHorizontal + i * (larguraCard + gap);

    doc
      .lineWidth(0.3)
      .roundedRect(xCard, baseYCards, larguraCard, cardAltura, 3)
      .stroke();

    const tx = xCard + 4;
    const ty = baseYCards + 3;

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .text(`PARCELA ${num}`, tx, ty, {
        width: larguraCard - 8,
      });

    doc
      .font('Helvetica')
      .fontSize(6)
      .text(`VENC.: ${dVenc}`, tx, ty + 8, {
        width: larguraCard - 8,
      })
      .text(`VALOR: ${vDupFmt}`, tx, ty + 16, {
        width: larguraCard - 8,
      });
  }
}

// ============================================================================
// ======================== CÁLCULO DO IMPOSTO ================================
// ============================================================================
const yImposto = yFatura + alturaQuadroDup + 12;  // 🔼 mais espaço abaixo dos cards
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
  // ✅ declarar ANTES para usar depois no início da tabela de produtos
  let yProdutosInicio;

  {
    // ── medidas / estilo base ────────────────────────────────────────────────
    const yTransp = yImposto + alturaLinhaFatura * 2 + 10; // começa após impostos
    const larguraTabela = 560; // 🔒 largura fixa da tabela (todas as linhas)

    // Estilo geral
    const style = {
      r: 3,               // raio das bordas de CADA célula
      lineWidth: 0.3,     // espessura da borda
      titleFont: 6,
      titleBold: true,
      valueFont: 9,
      valueBold: true,
      titleDx: 6,         // padding interno título (X)
      titleDy: 3,         // padding interno título (Y)
      valueDx: 6,         // padding interno valor (X)
      valueDy: 10,        // padding interno valor (Y)
      align: 'left',
      gapX: 0,            // espaço horizontal ENTRE células
      gapY: 0             // espaço vertical ENTRE linhas
    };

    const RIGHT = margemX + larguraTabela;
    const snap  = v => Math.round(v * 10) / 10; // suaviza serrilhado/float

    // ── helpers de texto e caixa ────────────────────────────────────────────
    function drawText(x, y, w, h, title, value, opt = {}) {
      const s = { ...style, ...opt };
      x = snap(x); y = snap(y); w = snap(w); h = snap(h);

      doc.font(s.titleBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(s.titleFont)
         .text(title ?? '', x + s.titleDx, y + s.titleDy, {
           width: w - s.titleDx * 2, align: s.align
         });

      doc.font(s.valueBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(s.valueFont)
         .text(value ?? '', x + s.valueDx, y + s.valueDy, {
           width: w - s.valueDx * 2, align: s.align
         });
    }

    // aceita: número (px), 'NN%', '*', '2*'...
    // OBS: ajusta o espaço disponível para considerar os gaps verticais
    function computeWidths(total, defs, gapX) {
      const nCols = defs.length;

      // espaço útil descontando gaps entre colunas
      const totalForCols = total - gapX * (nCols - 1);
      let fixed = 0, pctSum = 0, flexUnits = 0;

      const parts = defs.map(d => {
        if (typeof d === 'number') { fixed += d; return {k:'fixed', v:d}; }
        if (typeof d === 'string' && d.endsWith('%')) {
          const p = Math.max(0, parseFloat(d)); pctSum += p; return {k:'pct', v:p};
        }
        const m = String(d).match(/^(\d+)?\*$/);
        const w = m ? Number(m[1] || 1) : 0; flexUnits += w; return {k:'flex', v:w||1};
      });

      const pctPx = (pctSum/100) * totalForCols;
      let rem = totalForCols - fixed - pctPx; if (rem < 0) rem = 0;

      let widths = parts.map(p => p.k==='fixed' ? p.v
                            : p.k==='pct' ? (p.v/100)*totalForCols
                            : (flexUnits ? rem*(p.v/flexUnits) : 0));

      // corrige arredondamento para fechar em totalForCols
      const diff = totalForCols - widths.reduce((s,w)=>s+w,0);
      widths[widths.length-1] += diff;
      return widths.map(snap);
    }

    // desenha UMA linha com suas larguras e colspans, gerando caixas arredondadas
    function drawRow(y, h, widthDefs, cells) {
      const gX = style.gapX;
      const wcols = computeWidths(larguraTabela, widthDefs, gX);

      let col = 0;
      let x = margemX;

      for (const c of cells) {
        const span = Math.max(1, c.span || 1);
        const wColsSum = wcols.slice(col, col + span).reduce((s,a)=>s+a,0);
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
    const vol    = Array.isArray(transp.vol) ? transp.vol[0] : (transp.vol || {});
    const municipioTransp = transp?.transporta?.xMun || '';
    const ufTransp        = transp?.transporta?.UF || '';
    const fmtCNPJCPF = v => {
      const d = String(v||'').replace(/\D+/g,'');
      if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
      if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
      return v || '';
    };

    const labelModFrete = (code) => {
      const map = {
        '0': '0 - Emitente',
        '1': '1 - Destinatário',
        '2': '2 - Terceiros',
        '9': '9 - Sem Frete'
      };
      const k = String(Number(code));
      return map[k] || String(code ?? '');
    };
    const fmtPlaca = p => (p||'').toUpperCase();

    const nomeRazao = transp.transporta?.xNome || '';
    const freteTxt  = labelModFrete(transp.modFrete);
    const codANTT   = transp.transporta?.xCódAntt || transp.transporta?.ANTT || '';
    const placa     = fmtPlaca(transp.veicTransp?.placa || '');
    const ufVeiculo = transp.veicTransp?.UF || '';
    const docTransp = fmtCNPJCPF(transp.transporta?.CNPJ || transp.transporta?.CPF || '');
    const endereco  = transp.transporta?.xEnder || '';
    const municipio = municipioTransp || '';
    const ufT       = ufTransp || '';
    const ieTransp  = transp.transporta?.IE || '';
    const qtd       = (vol.qVol != null && vol.qVol !== '' ? String(vol.qVol) : '');
    const especie   = vol.esp  ?? '';
    const marca     = vol.marca ?? '';
    const numeracao = vol.nVol ?? '';

    const pesoB     = (vol.pesoB != null && vol.pesoB !== '' ? String(vol.pesoB) : '');
    const pesoL     = (vol.pesoL != null && vol.pesoL !== '' ? String(vol.pesoL) : '');

    const rowsCfg = [
      {
        h: 22,
        widths: [180, 80, 80, 80, 20, '*'],
        cells: [
          { title:'NOME / RAZÃO SOCIAL', value:nomeRazao, span:1, opt:{ valueFont:6 } },
          { title:'FRETE',               value:freteTxt,  span:1, opt:{ valueFont:6 } },
          { title:'CÓDIGO ANTT',         value:codANTT, span:1, opt:{ valueFont:6 } },
          { title:'PLACA DO VEÍCULO',    value:placa, span:1, opt:{ valueFont:6 } },
          { title:'UF',                  value:ufVeiculo, span:1, opt:{ valueFont:6 } },
          { title:'CNPJ / CPF',          value:docTransp, span:1, opt:{ valueFont:6 } }
        ]
      },
      {
        h: 22,
        //      0     1     2     3     4     5
        widths: [180, 120, 60, 90, 30, '*'],
        cells: [
          { title:'ENDEREÇO',           value:endereco,  span:3, opt:{ valueFont:6 } },
          { title:'MUNICÍPIO',          value:municipio, span:1, opt:{ valueFont:6 } },
          { title:'UF',                 value:ufT,       span:1, opt:{ valueFont:6 } },
          { title:'INSCRIÇÃO ESTADUAL', value:ieTransp,  span:1, opt:{ valueFont:6 }}
        ]
      },
            {
        h: 22,
        widths: [60, 120, 100, 100, 60, '*'],
        cells: [
          { title:'QUANTIDADE',   value:qtd, span:1, opt:{ valueFont:6 } },
          { title:'ESPÉCIE',      value:especie, span:1, opt:{ valueFont:6 } },
          { title:'MARCA',        value:marca, span:1, opt:{ valueFont:6 } },
          { title:'NUMERAÇÃO',    value:numeracao, span:1, opt:{ valueFont:6 } },
          { title:'PESO BRUTO',   value:pesoB, span:1, opt:{ valueFont:6 } },
          { title:'PESO LÍQUIDO', value:pesoL, span:1, opt:{ valueFont:6 } }
        ]
      }
    ];

    doc.lineJoin('round');
    let y = yTransp;

    // 🔹 TÍTULO DO BLOCO TRANSPORTADOR (igual ao DESTINATÁRIO)
    const titleXTransp = margemX + 6;
    const titleYTransp = yTransp - 7;

    doc
      .font('Helvetica-Bold')
      .fontSize(6)
      .text('TRANSPORTADOR / VOLUMES TRANSPORTADOS', titleXTransp, titleYTransp, {
        width: 350,
        align: 'left',
      });

    for (let i = 0; i < rowsCfg.length; i++) {
      const r = rowsCfg[i];
      drawRow(y, r.h, r.widths, r.cells);
      y += r.h + style.gapY;
    }

    const totalH = rowsCfg.reduce((s,r)=>s + r.h, 0) + style.gapY * (rowsCfg.length - 1);

    // próximo bloco (produtos) começa após tudo + margem
    yProdutosInicio = yTransp + totalH + 10;
  }

//=======================================
//======= Tabela de produtos (modelo DANFE clássico)
//=======================================
const ALT_LINHA_PROD = 20;
const LARGURA_TABELA = 560;

const colunas = [
  { titulo: 'CÓDIGO PRODUTO',                 campo: 'cProd',   largura: 43 },
  { titulo: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', campo: 'xProd',   largura: 180 },
  { titulo: 'NCM/SH',                          campo: 'NCM',    largura: 32 },
  { titulo: 'O/CST',                           campo: 'CST',    largura: 22 },
  { titulo: 'CFOP',                            campo: 'CFOP',   largura: 25 },
  { titulo: 'UN',                              campo: 'uCom',   largura: 22 },
  { titulo: 'QUANT',                           campo: 'qCom',   largura: 30 },
  { titulo: 'VALOR UNIT',                      campo: 'vUnCom', largura: 38 },
  { titulo: 'VALOR TOTAL',                     campo: 'vProd',  largura: 42 },
  { titulo: 'VALOR DESC',                      campo: 'vDesc',  largura: 22 },
  { titulo: 'B.CÁLC ICMS',                     campo: 'vBC',    largura: 22 },
  { titulo: 'VALOR ICMS',                      campo: 'vICMS',  largura: 22 },
  { titulo: 'VALOR IPI',                       campo: 'vIPI',   largura: 22 },
  { titulo: 'ALÍQ. ICMS',                      campo: 'pICMS',  largura: 20 },
  { titulo: 'ALÍQ. IPI',                       campo: 'pIPI',   largura: 20 },
];

const colXs = (() => {
  const xs = [margemX];
  let x = margemX;
  for (const c of colunas) { x += c.largura; xs.push(x); }
  return xs;
})();

// 🔹 Ponto inicial da tabela (logo após o bloco TRANSPORTADOR)
let yTabelaTopo = yProdutosInicio + 4; // desce um pouquinho para caber o título
let yAtual = yTabelaTopo;

// 🔹 TÍTULO DO BLOCO DE PRODUTOS / SERVIÇOS
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
  // TABELA PRODUTOS // - Sem caixas por célula // - Divisórias verticais tracejadas
  //=======================================================================================
  doc.font('Helvetica').fontSize(6);
  const COLS_NUMERICAS = new Set(['qCom','vUnCom','vProd','vDesc','vBC','pICMS','vICMS','pIPI','vIPI']);

  let alturaMaxArea = doc.page.height - 40 - yAtual;
  const yCorpoTopo = yAtual;

  // 👇 Marca d'água só no BLOCO DE PRODUTOS desta página
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

  (itensDet || []).forEach((item) => {
    const prod = item?.prod || {};

    const icmsObj = item?.imposto?.ICMS || {};
    const icmsKey = Object.keys(icmsObj || {})[0] || '';
    const icms    = (icmsObj && icmsObj[icmsKey]) || {};

    const vBC   = parseNumNFe(icms.vBC);
    const pICMS = parseNumNFe(icms.pICMS ?? icms.pICMSST);
    const vICMS = parseNumNFe(icms.vICMS ?? icms.vICMSST);

    const IPI     = item?.imposto?.IPI || {};
    const IPITrib = IPI?.IPITrib || {};
    const pIPI  = parseNumNFe(IPITrib?.pIPI);
    const vIPI  = parseNumNFe(IPITrib?.vIPI);

    const qCom   = parseNumNFe(prod.qCom);
    const vUnCom = parseNumNFe(prod.vUnCom);
    const vProd  = parseNumNFe(prod.vProd);
    const vDesc  = parseNumNFe(prod.vDesc);

    // Origem + CST → coluna "O/CST"
    const origem = (icms.orig ?? '0').toString();       // se não vier, assume '0'
    const cstCode = icms.CST || icms.CSOSN || '';       // CST ou CSOSN
    const oCst = `${origem}/${cstCode}`;                // ex: "0/60"

    const linha = {
      cProd : prod.cProd || '',
      xProd : prod.xProd || '',
      NCM   : prod.NCM || '',
      CST   : oCst,
      CFOP  : prod.CFOP || '',
      uCom  : prod.uCom || '',
      qCom  : fmtFixed(qCom,   3),
      vUnCom: fmtFixed(vUnCom, 4),
      vProd : fmtFixed(vProd,  2),
      vDesc : fmtFixed(vDesc,  2),
      vBC   : fmtFixed(vBC,    2),
      pICMS : fmtFixed(pICMS,  2),
      vICMS : fmtFixed(vICMS,  2),
      pIPI  : fmtFixed(pIPI,   2),
      vIPI  : fmtFixed(vIPI,   2),
    };

  // Quebra de página simples
  if (yAtual + ALT_LINHA_PROD > yCorpoTopo + alturaMaxArea) {
    const alturaUsada = yAtual - yTabelaTopo;
    doc.roundedRect(margemX, yTabelaTopo, LARGURA_TABELA, alturaUsada, raio).stroke();

    // ✅ stamp on top before leaving this page
    stampCancelOnTop();

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

    // 🔁 Recalcula área útil nesta nova página
    alturaMaxArea = doc.page.height - 40 - yAtual;
    const yCorpoTopoNova = yAtual;

    // 👇 Marca d'água só no BLOCO DE PRODUTOS desta nova página
    aplicarMarcaDAguaProdutos(doc, {
      x: margemX,
      y: yCorpoTopoNova,
      w: LARGURA_TABELA,
      h: alturaMaxArea
    });
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
    const ESPACO_ENTRE    = 8;
    const ALTURA_INFO     = 60;
    const larguraFisco    = 180;
    const gapBoxes        = 8;
    const raioInfo        = 3;

    const Y_FIM  = doc.page.height - MARGEM_INFERIOR;

    const Y_BASE = Math.max(
      yAtual,
      Y_FIM - (ALTURA_INFO + ESPACO_ENTRE)
    );

    if (yAtual < Y_BASE && Array.isArray(colXs)) {
      doc.lineWidth(0.3).dash(1.5, { space: 2 });
      for (let i = 1; i < colXs.length - 1; i++) {
        doc.moveTo(colXs[i], yAtual).lineTo(colXs[i], Y_BASE).stroke();
      }
      doc.undash();
    }

    const alturaTabelaFinal = Math.max(ALT_LINHA_PROD, Y_BASE - yTabelaTopo);
    doc.lineWidth(0.6).roundedRect(margemX, yTabelaTopo, LARGURA_TABELA, alturaTabelaFinal, 3).stroke();

    doc.moveTo(margemX, Y_BASE).lineTo(margemX + LARGURA_TABELA, Y_BASE).stroke();

    const yInfoTop = Y_BASE + ESPACO_ENTRE;
    const yTitulo  = yInfoTop - 7;

    doc.font('Helvetica-Bold').fontSize(6)
       .text('DADOS ADICIONAIS', margemX, yTitulo);

    const xLeft  = margemX;
    const wLeft  = LARGURA_TABELA - larguraFisco - gapBoxes;
    const xRight = xLeft + wLeft + gapBoxes;
    const hInfo  = ALTURA_INFO;

    doc.save().fillColor('white').roundedRect(xLeft, yInfoTop, wLeft, hInfo, raioInfo).fill().restore();
    doc.lineWidth(0.3).roundedRect(xLeft, yInfoTop, wLeft, hInfo, raioInfo).stroke();

    const legendTxt  = 'INFORMAÇÕES COMPLEMENTARES';
    doc.font('Helvetica-Bold').fontSize(7);
    const legendPadX = 5, legendPadY = 2, legendH = 12;
    const legendW    = doc.widthOfString(legendTxt) + legendPadX * 2;
    const legendX    = xLeft + 1;
    const legendY    = yInfoTop + 2;
    doc.save().fillColor('white').rect(legendX, legendY, legendW, legendH).fill().restore();
    doc.text(legendTxt, legendX + legendPadX, legendY + legendPadY);

    // DADOS ADICIONAIS
    const infAdOriginal = infNFe?.infAdic?.infCpl || '';
    const blocos = [];

    // 1) texto original do XML
    if (infAdOriginal.trim()) {
      blocos.push(infAdOriginal.trim());
    }

    // 2) DUPLICATAS (se existirem, têm prioridade)
    if (duplicatasInfoText) {
      blocos.push(duplicatasInfoText);
    }

    // 3) Senão, forma de pagamento como fallback
    else if (paymentInfoText) {
      blocos.push(paymentInfoText);
    }

    // Junta com quebra de linha
    const infAdFinal = blocos.join('\n').trim() || '—';

    doc.font('Helvetica').fontSize(7)
    .text(infAdFinal, xLeft + 8, yInfoTop + 18, {
      width: wLeft - 16,
      align: 'left'
    });

    doc.save().fillColor('white').roundedRect(xRight, yInfoTop, larguraFisco, hInfo, raioInfo).fill().restore();
    doc.lineWidth(0.3).roundedRect(xRight, yInfoTop, larguraFisco, hInfo, raioInfo).stroke();

    const legendFisco = 'RESERVADO AO FISCO';
    doc.font('Helvetica-Bold').fontSize(7);
    const legendFiscoW = doc.widthOfString(legendFisco) + legendPadX * 2;
    const legendFiscoX = xRight + 1;
    const legendFiscoY = yInfoTop + 2;
    doc.save().fillColor('white').rect(legendFiscoX, legendFiscoY, legendFiscoW, legendH).fill().restore();
    doc.text(legendFisco, legendFiscoX + legendPadX, legendFiscoY + legendPadY);

    const yRodape = Y_FIM + 6;
    const dataImpressao = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
    doc.font('Helvetica-Oblique').fontSize(9)
       .text(`Impresso em ${dataImpressao}`, margemX, yRodape);
    doc.text('Powered by ConsartErp®', margemX + LARGURA_TABELA - 140, yRodape, { width: 140, align: 'right' });
  })();

  // ✅ stamp on top on the final page too
stampCancelOnTop();

      doc.end();

  const buffer = await bufferPromise;

  return {
    buffer,
    filename: nomePDF,
    chaveAcesso: chaveBarRaw || null,
  };
}