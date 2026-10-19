'use strict';
// ╔══════════════════════════════════════════════════════════════════════╗
/* ║ 📄 danfeLayoutConsartController.js – Geração do PDF DANFE (rota + função SDK)   ║ */
// ╚══════════════════════════════════════════════════════════════════════╝

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const xml2js = require('xml2js');
const util = require('util');

// Parser com remoção de prefixos de namespace (nfe:, ns2:, etc.)
const { processors } = xml2js;

const parser = new xml2js.Parser({
  explicitArray: false,
  tagNameProcessors: [processors.stripPrefix],
  attrNameProcessors: [processors.stripPrefix],
});
const parseStringPromise = util.promisify(parser.parseString);

/** Utils */
const soNum = (s='') => String(s).replace(/\D+/g, '');

// Helpers visuais/formatadores para o bloco "Destinatário"
function fmt(v, def='—') {
  const s = (v ?? '').toString().trim();
  return s ? s : def;
}
function fmtCEP(cep='') {
  const d = soNum(cep);
  if (d.length === 8) return d.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return fmt(cep);
}
function titulo(doc, txt, x, y) {
  doc.font('Helvetica-Bold').fontSize(6).text(txt, x, y);
}
function valor(doc, txt, x, y, w) {
  doc.font('Helvetica').fontSize(9).text(txt, x, y, { width: w });
}
function campo(doc, {x, y, w, h, r=8, tituloTxt='', valorTxt=''}) {
  doc.lineWidth(0.6).roundedRect(x, y, w, h, r).stroke();
  titulo(doc, tituloTxt, x + 6, y + 4);
  valor(doc, valorTxt, x + 6, y + 12, w - 12);
}

/** Busca recursiva de chave insensível a caso */
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
  const infProt = (protNFe && findByKey(protNFe, 'infProt')) || findByKey(container || {}, 'infProt') || null;
  return { protNFe, infProt };
}

/**
 * Busca um arquivo XML da chave em múltiplos lugares e variações de nome.
 */
function localizarXMLPorChaveOuNome({ chave, xmlFile }) {
  const raw = String(xmlFile || chave || '').trim();
  const digits = soNum(raw);
  const baseName = raw.toLowerCase().endsWith('.xml') ? raw : (digits.length ? digits : raw);

  const bases = [
    path.join(__dirname, '../painelNotasFiscais/xml'),
    path.join(__dirname, '../xml'),
    path.join(__dirname, '../../public/painelNotasFiscais/xml'),
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
        console.log('✅ localizarXMLPorChaveOuNome: encontrado via varredura em', full);
        return { caminho: full, tentativas, meta: { raw, digits, baseName } };
      }
    } catch {
      // diretório pode não existir
    }
  }

  console.error('❌ localizarXMLPorChaveOuNome: XML NÃO ENCONTRADO.', {
    raw, digits, baseName, __dirname, cwd: process.cwd(), tentativas
  });

  return { caminho: null, tentativas, meta: { raw, digits, baseName } };
}

/** Tenta extrair uma chave de 44 dígitos do XML parsed + filename + parâmetro */
function extrairChave44({ parsed, xmlPath, paramChave }) {
  const { nfeProc, NFe, infNFe } = getInfNFe(parsed || {});
  const { infProt } = getProt(nfeProc || parsed || {});
  const fontes = [];

  // 1) Id do infNFe
  const idAttr = infNFe?.$?.Id || NFe?.infNFe?.$?.Id || '';
  const idDigits = soNum(String(idAttr).replace(/^NFe/i, ''));
  if (/^\d{44}$/.test(idDigits)) {
    fontes.push({ origem: 'infNFe.$.Id', valor: idDigits });
  }

  // 2) Protocolo (chNFe)
  const chProt = soNum(infProt?.chNFe || '');
  if (/^\d{44}$/.test(chProt)) {
    fontes.push({ origem: 'protNFe.infProt.chNFe', valor: chProt });
  }

  // 3) Nome do arquivo
  const fileDigits = soNum(path.basename(xmlPath || ''));
  if (/^\d{44}$/.test(fileDigits)) {
    fontes.push({ origem: 'nome_arquivo', valor: fileDigits });
  }

  // 4) Parâmetro recebido
  const paramDigits = soNum(paramChave || '');
  if (/^\d{44}$/.test(paramDigits)) {
    fontes.push({ origem: 'parametro', valor: paramDigits });
  }

  // prioridade: Id > prot > nome_arquivo > parametro
  const preferencia = ['infNFe.$.Id', 'protNFe.infProt.chNFe', 'nome_arquivo', 'parametro'];
  const escolhido = fontes.sort((a,b) => preferencia.indexOf(a.origem) - preferencia.indexOf(b.origem))[0];

  if (escolhido) {
    console.log(`[DANFE] Chave de acesso obtida de ${escolhido.origem}: ${escolhido.valor}`);
    return escolhido.valor;
  }

  return '';
}

/** Calcula a chave de acesso (44 dígitos) a partir do infNFe (sem autorização).
 * Fórmula: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + DV(1)
 * DV: módulo 11 com pesos [2..9] repetindo, conforme manual da NF-e.
 */
function calcularChave44DeInfNFe(infNFe) {
  try {
    const soNum = (s='') => String(s).replace(/\D+/g, '');
    const ide = infNFe?.ide || {};
    const emit = infNFe?.emit || {};

    const cUF   = soNum(ide.cUF).padStart(2, '0');              // ex.: '31'
    const dhEmi = String(ide.dhEmi || ide.dEmi || '');          // ex.: '2025-08-14T...'
    const AAMM  = dhEmi ? (dhEmi.slice(2,4) + dhEmi.slice(5,7)) : '0000'; // '2508' por ex.
    const CNPJ  = soNum(emit.CNPJ).padStart(14, '0');           // 14 dígitos
    const mod   = soNum(ide.mod || '55').padStart(2, '0');      // '55'
    const serie = soNum(ide.serie).padStart(3, '0');            // 3 dígitos
    const nNF   = soNum(ide.nNF).padStart(9, '0');              // 9 dígitos
    const tpEmis= soNum(ide.tpEmis || '1').padStart(1, '0');    // 1 dígito
    const cNF   = soNum(ide.cNF).padStart(8, '0');              // 8 dígitos

    // precisa, no mínimo: cUF, AAMM, CNPJ, mod, serie, nNF, tpEmis, cNF
    const base43 = cUF + AAMM + CNPJ + mod + serie + nNF + tpEmis + cNF;
    if (base43.length !== 43 || /[^0-9]/.test(base43)) return '';

    // DV módulo 11 (pesos 2..9)
    let peso = 2, soma = 0;
    for (let i = base43.length - 1; i >= 0; i--) {
      soma += Number(base43[i]) * peso;
      peso = (peso === 9) ? 2 : (peso + 1);
    }
    let dv = 11 - (soma % 11);
    if (dv >= 10) dv = 0;

    return base43 + String(dv);
  } catch {
    return '';
  }
}

/**
 * Gera o PDF da DANFE de forma programática (sem Express).
 * @param {Object} args
 * @param {string|number} args.numero
 * @param {string|number} args.serie
 * @param {string}        args.chave        - 44 dígitos (opcional se xmlFile/xmlContent)
 * @param {string}        args.xmlFile      - nome/caminho do XML (opcional)
 * @param {string}        args.xmlContent   - conteúdo XML em string (opcional)
 * @param {Object}        args.prot         - protocolo (nProt, dhRecbto)
 * @returns {Promise<{caminho_pdf: string}>}
 */
async function gerarDanfeArquivo({ numero = '000123', serie = '1', chave = '', xmlFile = null, xmlContent = null, prot = {} } = {}) {
  console.log('🧩 gerarDanfeArquivo params:', {
    numero, serie, hasXmlContent: !!xmlContent,
    chave: String(chave || '').slice(0,8) + (String(chave || '').length ? '…' : ''),
    xmlFile
  });

  // 1) obter XML (conteúdo em memória OU arquivo)
  let xmlPath = null;
  let xmlStr  = xmlContent || null;

  if (!xmlStr) {
    const ach = localizarXMLPorChaveOuNome({ chave, xmlFile });
    xmlPath = ach.caminho;

    if (!xmlPath) {
      const msg = [
        'Arquivo XML não encontrado para a chave/arquivo informado.',
        `Parâmetros: chave="${chave}", xmlFile="${xmlFile}"`,
        `Tentativas (${ach.tentativas.length}):`,
        ...ach.tentativas.map(t => ` - ${t}`)
      ].join('\n');
      throw new Error(msg);
    }
    xmlStr = fs.readFileSync(xmlPath, 'utf-8');
  }

  // 2) parse do XML
  const parsed = await parseStringPromise(xmlStr);

  // ── Normalização de caminhos do XML ──────────────────────────────────────
  const { nfeProc, NFe: NFeNode, infNFe } = getInfNFe(parsed);
  if (!infNFe) {
    console.error('[DANFE] infNFe não encontrado. Raiz tem chaves:', Object.keys(parsed || {}));
    throw new Error('Não foi possível extrair os dados da NFe.');
  }

  // ---- Helpers
  const asArray = (x) => (Array.isArray(x) ? x : (x ? [x] : []));

  // Busca profunda por possíveis itens de produto (nós que têm 'prod')
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

  // 3) dados úteis (definidos ANTES do uso)
  const ide  = infNFe.ide || {};
  const emit = infNFe.emit || {};
  const dest = infNFe.dest || {};
  const endDest = dest?.enderDest || dest?.ender || {};
  const naturezaOperacao = ide?.natOp || 'VENDA DE MERCADORIA';

  // 4) itens (det) – caminhos canônicos + fallback profundo
  let itensDet = asArray(infNFe?.det);
  if (!itensDet.length) itensDet = asArray(NFeNode?.det);
  if (!itensDet.length) itensDet = extractDetRobusto(NFeNode);

  if (!itensDet.length) {
    const preview = JSON.stringify(infNFe, (k, v) => (k === 'det' ? undefined : v), 2).slice(0, 800);
    console.warn('[DANFE] Nenhum item encontrado. Preview de infNFe (sem det):\n', preview);
  } else {
    console.log(`[DANFE] Itens encontrados: ${itensDet.length}`);
  }

  // 5) preparar chave/ barcode (robusto + cálculo se faltar)
  const { infProt } = getProt(nfeProc || parsed);

  // tenta achar pelos caminhos usuais (Id / chNFe / nome arquivo / parametro)
  let chaveBarRaw = extrairChave44({ parsed, xmlPath, paramChave: chave });

  // Se ainda não tiver, calculamos a chave (sem autorização) a partir do infNFe
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
      console.warn('[DANFE] Falha ao gerar código de barras. Continuando sem barras.', e.message);
    }
  } else {
    console.warn('[DANFE] Chave de acesso ausente/ inválida. Renderizando sem código de barras.');
  }

  // 7) criar PDF
  const doc = new PDFDocument({ size: 'A4', margin: 20 });
const nomePDF = `danfe_${String(ide.nNF || numero).padStart(3, '0')}.pdf`;

// Base configurável por ENV (Cloud Run)
const OUT_BASE = process.env.NFE_OUTPUT_DIR || path.join(__dirname, '../../public/painelNotasFiscais');
const pastaPDF = path.join(OUT_BASE, 'pdf');

if (!fs.existsSync(pastaPDF)) fs.mkdirSync(pastaPDF, { recursive: true });
const caminhoPDF = path.join(pastaPDF, nomePDF);

// Caminho público a partir de /public
const caminhoPublico = `/public/painelNotasFiscais/pdf/${nomePDF}`;

const stream = fs.createWriteStream(caminhoPDF);
  doc.pipe(stream);

  // ==== Layout (igual ao seu, sem alterações de lógica) ====
  const margemX = 20;
  const larguraTotal = 545;

  // Cabeçalho/canhoto
  const emissaoISO = ide?.dhEmi || ide?.dEmi || '';
  const dataEmissao = emissaoISO ? (emissaoISO.split('T')[0] || '').split('-').reverse().join('/') : '--/--/----';
  const valorTotalNF = Number(infNFe?.total?.ICMSTot?.vNF || 0);
  const valorTotalFmt = valorTotalNF.toLocaleString('pt-BR',{style:'currency', currency:'BRL'});
  const destinatario = dest?.xNome || '---';
  const enderecoStr = [endDest.xLgr, endDest.nro, endDest.xBairro, endDest.xMun, endDest.UF].filter(Boolean).join(', ');

  const margemY = 10;
  const larguraNF = 105;
  const alturaCanhoto = 25;
  const paddingInterno = 5;

  doc.lineWidth(0.3)
     .roundedRect(margemX, margemY, larguraTotal - larguraNF, alturaCanhoto, 3)
     .stroke();

  const textoCanhoto = `RECEBEMOS DE ${emit?.xNome || '---'} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO. EMISSÃO: ${dataEmissao} VALOR TOTAL: ${valorTotalFmt} DESTINATÁRIO: ${destinatario} - ${enderecoStr}`;
  doc.font('Helvetica').fontSize(6)
     .text(textoCanhoto, margemX + paddingInterno, margemY + paddingInterno, {
       width: larguraTotal - larguraNF - paddingInterno * 2,
       align: 'left'
     });

  // Campos de recebimento e assinatura
  const alturaCampoRecebimento = 20;
  const larguraCampoRecebimento = 100;
  const posXRecebimento = margemX;
  const posYRecebimento = margemY + alturaCanhoto;

  doc.fontSize(5).text('DATA DE RECEBIMENTO', posXRecebimento + paddingInterno, posYRecebimento + 2);
  doc.lineWidth(0.3)
     .roundedRect(posXRecebimento, posYRecebimento, larguraCampoRecebimento, alturaCampoRecebimento, 2)
     .stroke();

  const larguraCampoAssinatura = 340;
  const alturaCampoAssinatura = 20;
  const posXAssinatura = posXRecebimento + larguraCampoRecebimento;
  const posYAssinatura = posYRecebimento;

  doc.fontSize(5).text('IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', posXAssinatura + paddingInterno, posYAssinatura + 2);
  doc.lineWidth(0.3)
     .roundedRect(posXAssinatura, posYAssinatura, larguraCampoAssinatura, alturaCampoAssinatura, 2)
     .stroke();

  // Quadro “NF-e”
  const larguraQuadroNFE = 120;
  const alturaQuadroNFE = 45;
  const posXNFE = margemX + larguraTotal - larguraQuadroNFE + 15;
  const posYNFE = margemY;

  doc.lineWidth(0.3).roundedRect(posXNFE, posYNFE, larguraQuadroNFE, alturaQuadroNFE, 3).stroke();
  doc.font('Helvetica-Bold').fontSize(16).text('NF-e', posXNFE, posYNFE + 7, { width: larguraQuadroNFE, align: 'center' });
  doc.fontSize(8).text(`Nº ${ide.nNF || '-'}`, posXNFE, posYNFE + 20, { width: larguraQuadroNFE, align: 'center' });
  doc.fontSize(8).text(`Série ${ide.serie || '-'}`, posXNFE, posYNFE + 30, { width: larguraQuadroNFE, align: 'center' });

  // Cabeçalho emitente
  doc.font('Helvetica-Bold').fontSize(2).text('IDENTIFICAÇÃO DO EMITENTE', margemX + 10, 62);
  doc.lineWidth(0.3).roundedRect(margemX, 58, 220, 90, ).stroke();

  // Caminho da logo (ajuste para onde você salvar a sua imagem)
  const logoPath = path.join(__dirname, '../../public/imagens/logo.png');

  // Dimensões do QUADRO do emitente (as mesmas que você usa no roundedRect)
  const boxEmit = { x: margemX, y: 45, w: 220, h: 90 };

  // Tamanho máximo da logo dentro do quadro (mantém proporção)
  const LOGO_MAX_W = 100;   // largura máx. (px/pt)
  const LOGO_MAX_H = 80;   // altura máx.

  // Posição da logo (esquerda dentro do quadro)
  const logoX = boxEmit.x + 8;
  const logoY = boxEmit.y + 16;

  // Se existir arquivo, desenha a logo
  let deslocamentoTextoX = 0;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, logoX, logoY, { fit: [LOGO_MAX_W, LOGO_MAX_H] });
    deslocamentoTextoX = LOGO_MAX_W + 16; // deixa espaço para a logo + respiro
  }

  // Agora, RECUA os textos para a direita da logo (em vez de usar valores fixos)
  const infoX = boxEmit.x + 5 + deslocamentoTextoX;
  const infoW = boxEmit.w - deslocamentoTextoX - 10;

  // (substitua os seus textos por estes com infoX/infoW)
  doc.font('Helvetica-Bold').fontSize(5) //BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA
     .text((emit.xNome || '---').toUpperCase(), infoX, 75, { width: infoW, align: 'left' });

  const endEmit = emit?.enderEmit || {};
  doc.font('Helvetica').fontSize(5)
     .text(`${endEmit.xLgr || ''}, ${endEmit.nro || ''}`, infoX, 90, { width: infoW })
     .text(`${endEmit.xBairro || ''} - CEP: ${endEmit.CEP || ''}`, infoX, 98, { width: infoW })
     .text(`${endEmit.xMun || ''} - ${endEmit.UF || ''}   Fone: ${endEmit.fone || ''}`, infoX, 106, { width: infoW });

  // Moldura “DANFE”
  doc.lineWidth(0.3).roundedRect(margemX + 220, 58, 90, 90, 4).stroke();
  doc.font('Helvetica-Bold').fontSize(11).text('DANFE', margemX + 225, 61, { width: 80, align: 'center' });
  doc.font('Helvetica').fontSize(6).text('Documento Auxiliar da Nota', margemX + 230, 75)
                                  .text('Fiscal Eletrônica', margemX + 245, 85);
  doc.font('Helvetica-Bold').fontSize(8)
     .text(`NF-e Nº ${ide.nNF || '-'}`, margemX + 245, 110)
     .text(`Série ${ide.serie || '-'}`, margemX + 253, 120)
     .text(`Folha 1/1`, margemX + 250, 130);

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
        opt: { valueFont: 11, valueBold: true } }
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
  (function renderDestinatario(){
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
      align: 'left'
    };
    
    function drawField(docRef, {x, y, w, h, title, value, style = {}}) {
      const s = { ...defaultFieldStyle, ...style };
      docRef.lineWidth(s.lineWidth).roundedRect(x, y, w, h, s.r).stroke();
      docRef.font(s.titleBold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(s.titleFont)
            .text(title, x + s.titleDx, y + s.titleDy, { width: w - s.titleDx * 2, align: s.align });
      docRef.font(s.valueBold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(s.valueFont)
            .text(value, x + s.valueDx, y + s.valueDy, { width: w - s.valueDx * 2, align: s.align });
    }

    const endDest = dest?.enderDest || dest?.ender || {};
    const fmt = (v, def='—') => (String(v ?? '').trim() || def);
    const fmtCEP = (cep='') => { const d = soNum(cep); return d.length===8 ? d.replace(/^(\d{5})(\d{3})$/,'$1-$2') : fmt(cep); };
    const fmtCNPJCPF = (v)=>{ const d=soNum(v||''); if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'); if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'); return fmt(v); };
    const fmtFone = (v)=>{ const d=soNum(v||''); if(d.length===10)return d.replace(/^(\d{2})(\d{4})(\d{4})$/,'($1) $2-$3'); if(d.length===11)return d.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3'); return fmt(v,''); };
    const soData = (iso)=>{ if(!iso)return '—'; const d=String(iso).split('T')[0]||''; if(!d)return '—'; const [Y,M,D]=d.split('-'); return (D&&M&&Y)?`${D}/${M}/${Y}`:'—'; };
    const soHora = (iso)=>{ if(!iso)return ''; const t=String(iso).split('T')[1]||''; return t?t.substring(0,8):''; };

    const VAL = {
      nome:       fmt((dest?.xNome || '').toUpperCase()),
      cnpjCpf:    fmtCNPJCPF(dest?.CNPJ || dest?.CPF),
      dataEmi:    soData(ide?.dhEmi || ide?.dEmi || ''),

      endereco:   fmt(((endDest?.xLgr || '').toUpperCase()) + (endDest?.nro ? `, ${String(endDest.nro).toUpperCase()}` : '')),
      bairro:     fmt((endDest?.xBairro || '-').toUpperCase()),
      cep:        fmtCEP(endDest?.CEP),
      dataSai:    soData(ide?.dhSaiEnt || ide?.dSaiEnt || '') || soData(ide?.dhEmi || ide?.dEmi || ''),

      municipio:  fmt((endDest?.xMun || '').toUpperCase()),
      uf:         fmt((endDest?.UF || '').toUpperCase(), ' '),
      fone:       fmtFone(endDest?.fone),
      ie:         fmt(dest?.IE),
      horaSai:    soHora(ide?.dhSaiEnt || ide?.dSaiEnt || '') || soHora(ide?.dhEmi || ide?.dEmi || '')
    };

    const cfgDest = {
      xStart: margemX,
      yStart: 200,
      rowGap: 0,
      rows: [
        {
          height: 24,
          fields: [
            { key: 'nome',     title: 'NOME / RAZÃO SOCIAL', value: VAL.nome,     width: 340, style: { valueFont: 7, valueBold: true } },
            { key: 'cnpjCpf',  title: 'CNPJ / CPF',          value: VAL.cnpjCpf,  width: 125,  style: { valueFont: 7 } },
            { key: 'dataEmi',  title: 'DATA DA EMISSÃO',     value: VAL.dataEmi,  width: 95, style: { valueFont: 7, align: 'left' } }
          ]
        },
        {
          height: 24,
          fields: [
            { key: 'endereco', title: 'ENDEREÇO',             value: VAL.endereco, width: 260, style: { valueFont: 7 } },
            { key: 'bairro',   title: 'BAIRRO / DISTRITO',     value: VAL.bairro,   width: 120,  style: { valueFont: 7 } },
            { key: 'cep',      title: 'CEP',                   value: VAL.cep,      width: 85,  style: { valueFont: 7 } },
            { key: 'dataSai',  title: 'DATA DA SAÍDA/ENTRADA', value: VAL.dataSai,  width: 95,  style: { valueFont: 7 } }
          ]
        },
        {
          height: 24,
          fields: [
            { key: 'municipio', title: 'MUNICÍPIO',                value: VAL.municipio, width: 260, style: { valueFont: 7 } },
            { key: 'uf',        title: 'UF',                       value: VAL.uf,        width: 35,  style: { valueFont: 7, align: 'center' } },
            { key: 'fone',      title: 'FONE / FAX',               value: VAL.fone,      width: 90,  style: { valueFont: 7 } },
            { key: 'ie',        title: 'INSCRIÇÃO ESTADUAL',       value: VAL.ie,        width: 80,  style: { valueFont: 7 } },
            { key: 'horaSai',   title: 'HORA DA SAÍDA/ENTRADA',    value: VAL.horaSai||'—', width: 95, style: { valueFont: 7, align: 'center' } }
          ]
        }
      ]
    };

    let y = cfgDest.yStart;
    cfgDest.rows.forEach((row) => {
      const h = row.height;
      let x = cfgDest.xStart;
      row.fields.forEach((f) => {
        drawField(doc, {
          x, y, w: f.width, h,
          title: f.title,
          value: f.value,
          style: f.style
        });
        x += f.width;
      });
      y += h + (cfgDest.rowGap || 0);
    });
  })(); 

  // ============================================================================
  // ============================= FATURA DUPLICATA =============================
  // ============================================================================
  const yFatura = 290;
  const alturaLinhaFatura = 22;
  const larguraFat = 150;

  // helper rápido para usar o findByKey já declarado lá em cima
  const getNodeDeep = (root, key) => findByKey(root || {}, key) || {};

  // 1) tenta achar COBR / DUP em qualquer lugar do infNFe / parsed
  const cobrNode =
    getNodeDeep(infNFe, 'cobr') ||
    getNodeDeep(parsed, 'cobr') ||
    {};

  let duplicatas = [];
  if (cobrNode) {
    const rawDup = cobrNode.dup || cobrNode.DUP;
    if (Array.isArray(rawDup)) {
      duplicatas = rawDup;
    } else if (rawDup) {
      duplicatas = [rawDup];
    }
  }

  // 2) Se NÃO houver duplicatas, usa PAG / DETPAG como fonte (forma de pagamento)
  if (!duplicatas.length) {
    const pagNode =
      getNodeDeep(infNFe, 'pag') ||
      getNodeDeep(parsed, 'pag') ||
      {};

    const rawDet = pagNode.detPag || pagNode.detpag || pagNode.DETPAG;
    const detPagList = Array.isArray(rawDet)
      ? rawDet
      : (rawDet ? [rawDet] : []);

    const labelFormaPagamento = (tPag, xPag) => {
      const cod = String(tPag ?? '').padStart(2, '0');
      const mapa = {
        '01': '01 - Dinheiro',
        '02': '02 - Cheque',
        '03': '03 - Cartão de Crédito',
        '04': '04 - Cartão de Débito',
        '05': '05 - Crédito Loja',
        '10': '10 - Vale Alimentação',
        '11': '11 - Vale Refeição',
        '12': '12 - Vale Presente',
        '13': '13 - Vale Combustível',
        '14': '14 - Duplicata Mercantil',
        '15': '15 - Boleto Bancário',
        '16': '16 - Depósito Bancário',
        '17': '17 - PIX',
        '18': '18 - Carteira Digital',
        '19': '19 - Programa Fidelidade',
        '90': '90 - Sem Pagamento',
        '99': `99 - Outros (${xPag || '—'})`
      };
      return mapa[cod] || `${cod} - ${xPag || 'Forma de pagamento'}`;
    };

    // monta "duplicatas" fake a partir do grupo <pag>
    duplicatas = detPagList.map((p, idx) => {
      const forma = labelFormaPagamento(p.tPag, p.xPag);

      // tenta usar dVenc do XML; se não tiver, usa data de saída/emissão
      const dVencRaw =
        p.dVenc ||
        ide?.dSaiEnt ||
        ide?.dhSaiEnt ||
        ide?.dEmi ||
        ide?.dhEmi ||
        '';

      const dVenc = dVencRaw
        ? String(dVencRaw).split('T')[0].split('-').reverse().join('/')
        : '';

      return {
        nDup: forma,               // ex.: "15 - Boleto Bancário"
        dVenc: dVenc,              // dd/mm/aaaa
        vDup: p.vPag || 0          // valor da parcela
      };
    });

    // 🔎 debug opcional
    console.log('[DANFE] detPag encontrados para FATURA:', detPagList);
  }

  // 3) renderiza, se tiver algo
  doc.font('Helvetica-Bold').fontSize(6)
     .text('FATURA / DUPLICATA', margemX + 2, yFatura - 10);

  duplicatas.slice(0, 2).forEach((dup, i) => {
    const x = margemX + i * larguraFat;
    const num = dup.nDup || '';
    const venc = dup.dVenc || '';
    const valor = Number(dup.vDup || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    doc.lineWidth(0.3)
       .roundedRect(x, yFatura, larguraFat, alturaLinhaFatura, 3)
       .stroke();

    doc.font('Helvetica-Bold').fontSize(6)
       .text(`Num.: ${num}`, x + 4, yFatura + 2);
    doc.font('Helvetica').fontSize(6)
       .text(`Venc.: ${venc}`, x + 4, yFatura + 10);
    doc.text(`Valor: ${valor}`, x + 90, yFatura + 10);
  });
  
  // ============================================================================
  // ======================== CALCULO DO IMPOSTO ================================
  // ============================================================================
  const yImposto = yFatura + alturaLinhaFatura + 10;
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
    const qtd       = (vol.qVol != null ? String(vol.qVol) : '0');
    const especie   = vol.esp || '';
    const marca     = vol.marca || '';
    const numeracao = vol.nVol || '';
    const pesoB     = (vol.pesoB != null ? String(vol.pesoB) : '0,00');
    const pesoL     = (vol.pesoL != null ? String(vol.pesoL) : '0,00');

    const rowsCfg = [
      {
        h: 22,
        widths: [180, 80, 80, 80, 20, '*'],
        cells: [
          { title:'NOME / RAZÃO SOCIAL', value:nomeRazao, span:1, opt:{ valueFont:6 } },
          { title:'FRETE',               value:freteTxt,  span:1, opt:{ valueFont:6 } },
          { title:'CÓDIGO ANTT',         value:codANTT },
          { title:'PLACA DO VEÍCULO',    value:placa },
          { title:'UF',                  value:ufVeiculo },
          { title:'CNPJ / CPF',          value:docTransp }
        ]
      },
      {
        h: 22,
        widths: [180, 120, 60, 70, 60, '*'],
        cells: [
          { title:'ENDEREÇO',           value:endereco,  span:3, opt:{ valueFont:12 } },
          { title:'MUNICÍPIO',          value:municipio, span:1, opt:{ valueFont:12 } },
          { title:'UF',                 value:ufT,       span:1 },
          { title:'INSCRIÇÃO ESTADUAL', value:ieTransp,  span:1 }
        ]
      },
      {
        h: 22,
        widths: [60, 120, 100, 100, 60, '*'],
        cells: [
          { title:'QUANTIDADE',   value:qtd },
          { title:'ESPÉCIE',      value:especie },
          { title:'MARCA',        value:marca },
          { title:'NUMERAÇÃO',    value:numeracao },
          { title:'PESO BRUTO',   value:pesoB },
          { title:'PESO LÍQUIDO', value:pesoL }
        ]
      }
    ];

    doc.lineJoin('round');
    let y = yTransp;

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
    { titulo: 'DESCRIÇÃO DO PRODUTO / SERVIÇO', campo: 'xProd',   largura: 130 },
    { titulo: 'NCM/SH',                          campo: 'NCM',    largura: 40 },
    { titulo: 'O/CST',                           campo: 'CST',    largura: 28 },
    { titulo: 'CFOP',                            campo: 'CFOP',   largura: 30 },
    { titulo: 'UN',                              campo: 'uCom',   largura: 22 },
    { titulo: 'QUANT',                           campo: 'qCom',   largura: 33 },
    { titulo: 'VALOR UNIT',                      campo: 'vUnCom', largura: 38 },
    { titulo: 'VALOR TOTAL',                     campo: 'vProd',  largura: 35 },
    { titulo: 'VALOR DESC',                      campo: 'vDesc',  largura: 30 },
    { titulo: 'B.CÁLC ICMS',                     campo: 'vBC',    largura: 30 },
    { titulo: 'VALOR ICMS',                      campo: 'vICMS',  largura: 20 },
    { titulo: 'VALOR IPI',                       campo: 'vIPI',   largura: 20 },
    { titulo: 'ALÍQ. ICMS',                      campo: 'pICMS',  largura: 20 },
    { titulo: 'ALÍQ. IPI',                       campo: 'pIPI',   largura: 20 },
  ];

  const colXs = (() => {
    const xs = [margemX];
    let x = margemX;
    for (const c of colunas) { x += c.largura; xs.push(x); }
    return xs;
  })();

  // 🔹 Ponto inicial da tabela
  let yTabelaTopo = yProdutosInicio;
  let yAtual = yTabelaTopo;

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

  const alturaMaxArea = doc.page.height - 40 - yAtual;
  const yCorpoTopo = yAtual;

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

    const linha = {
      cProd : prod.cProd || '',
      xProd : prod.xProd || '',
      NCM   : prod.NCM || '',
      CST   : icms.CST || icms.CSOSN || '',
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

      doc.addPage();
      yTabelaTopo = 40;
      yAtual = yTabelaTopo;

      doc.roundedRect(margemX, yAtual, LARGURA_TABELA, ALT_LINHA_PROD, raio).stroke();
      doc.undash();
      for (let i = 1; i < colXs.length - 1; i++) {
        doc.moveTo(colXs[i], yAtual).lineTo(colXs[i], yAtual + ALT_LINHA_PROD).stroke();
      }
      doc.font('Helvetica-Bold').fontSize(5);
      for (let i = 0; i < colunas.length; i++) {
        const col = colunas[i];
        const x0 = colXs[i];
        doc.text(String(col.titulo).replace(' / ', '\n'), x0 + 2, yAtual + 4, { width: col.largura - 4, align: 'left' });
      }
      yAtual += ALT_LINHA_PROD;
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

    const infAd = infNFe?.infAdic?.infCpl || '';
    doc.font('Helvetica').fontSize(7)
       .text(infAd, xLeft + 8, yInfoTop + 18, { width: wLeft - 16, align: 'left' });

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

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Caminho exposto (estático /public)
  return { caminho_pdf: caminhoPublico, danfe_pdf: caminhoPublico };
}

/** Implementação “custom” opcional: delega ao gerarDanfeArquivo. */
async function danfeCustom(params) {
  const out = await gerarDanfeArquivo(params || {});
  return out?.caminho_pdf || null;
}

/** Rota HTTP que usa a função programática. */
async function gerarPDF(req, res) {
  try {
    const out = await gerarDanfeArquivo(req.body || {});
    return res.json({ sucesso: true, caminho_pdf: out.caminho_pdf });
  } catch (error) {
    console.error('❌ Erro ao gerar DANFE:', error);
    return res.status(400).json({ erro: error.message || 'Erro ao gerar DANFE.' });
  }
}

module.exports = {
  gerarPDF,
  gerarDanfeArquivo,
  danfeCustom,
  localizarXMLPorChaveOuNome
};
