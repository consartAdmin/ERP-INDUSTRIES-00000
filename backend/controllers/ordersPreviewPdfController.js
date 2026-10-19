// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersPreviewPdfController.js — Preview DANFE da NF-e por Pedido    ║
// ║ CONSART ERP                                                         ║
// ║ ✔ Gera preview da NF-e antes da emissão                             ║
// ║ ✔ Usa ordersApi + tecnospeedNfeApi                                  ║
// ║ ✔ Converte JSON da NF-e em XML temporário para o danfeConsart       ║
// ║ ✔ NÃO depende de XML já emitido pela PlugNotas                      ║
// ║ ✔ FIX: importa pagamentos reais de budgetsPayments                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ordersApi from '../repositories/orders/orders.index.js';
import tecnospeedNfeApi from '../repositories/nfe/nfe.index.js';
import { generateDanfeFromXml } from '../services/danfeConsartService.js';

/* ──────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────── */
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

const money4 = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(4) : '0.0000';
};

const money2 = (v) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

const escapeXml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function formatDhEmi(value) {
  if (!value) {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}-03:00`;
  }

  const s = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00:00-03:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    if (/[+-]\d{2}:\d{2}$/.test(s) || s.endsWith('Z')) return s;
    return `${s}-03:00`;
  }

  return s;
}

function extractNumero(nfeJson, header) {
  return Number(
    nfeJson?.numero ??
    header?.nfe_number ??
    header?.number ??
    1
  ) || 1;
}

function extractSerie(nfeJson, header) {
  return Number(
    nfeJson?.serie ??
    header?.nfe_serie ??
    header?.serie ??
    1
  ) || 1;
}

function calcItemValues(item) {
  const qtd =
    Number(item?.quantidade?.comercial ?? item?.quantidade?.tributavel ?? 0) || 0;

  const vUnit =
    Number(item?.valorUnitario?.comercial ?? item?.valorUnitario?.tributavel ?? 0) || 0;

  const vProd =
    Number(item?.valor ?? qtd * vUnit) || 0;

  const vDesc =
    Number(item?.desconto ?? 0) || 0;

  return { qtd, vUnit, vProd, vDesc };
}

function sumNfeTotals(nfeJson) {
  const itens = asArray(nfeJson?.itens);

  let vProd = 0;
  let vDesc = 0;
  let vBC = 0;
  let vICMS = 0;
  let vIPI = 0;
  let vPIS = 0;
  let vCOFINS = 0;

  for (const item of itens) {
    const vals = calcItemValues(item);
    vProd += vals.vProd;
    vDesc += vals.vDesc;

    const icms = item?.tributos?.icms || {};
    const ipi = item?.tributos?.ipi || {};
    const pis = item?.tributos?.pis || {};
    const cofins = item?.tributos?.cofins || {};

    vBC += Number(icms?.baseCalculo?.valor ?? 0) || 0;
    vICMS += Number(icms?.valor ?? 0) || 0;
    vIPI += Number(ipi?.valor ?? 0) || 0;
    vPIS += Number(pis?.valor ?? 0) || 0;
    vCOFINS += Number(cofins?.valor ?? 0) || 0;
  }

  const frete = Number(nfeJson?.transporte?.frete ?? 0) || 0;
  const seguro = Number(nfeJson?.transporte?.seguro ?? 0) || 0;
  const outras = Number(nfeJson?.outrasDespesas ?? 0) || 0;
  const vNF = vProd - vDesc + frete + seguro + outras + vIPI;

  return {
    vBC,
    vICMS,
    vICMSDeson: 0,
    vFCP: 0,
    vBCST: 0,
    vST: 0,
    vFCPST: 0,
    vFCPSTRet: 0,
    vProd,
    vFrete: frete,
    vSeg: seguro,
    vDesc,
    vII: 0,
    vIPI,
    vIPIDevol: 0,
    vPIS,
    vCOFINS,
    vOutro: outras,
    vNF,
    vTotTrib: vPIS + vCOFINS + vICMS + vIPI,
    vICMSUFDest: 0,
    vFCPUFDest: 0,
    vICMSUFRemet: 0,
  };
}

function buildIdeXml(nfeJson, numero, serie, dhEmi, header) {
  const natureza = nfeJson?.natureza || 'VENDA DE MERCADORIAS';
  const tpNF = '1';
  const idDest = '1';
  const indFinal = nfeJson?.consumidorFinal ? '1' : '0';
  const indPres = String(nfeJson?.presencial ?? '1');
  const mod = '55';
  const tpImp = '1';
  const tpEmis = '1';
  const finNFe = '1';
  const procEmi = '0';
  const verProc = 'CONSART ERP 1.0';
  const cMunFG =
    nfeJson?.destinatario?.endereco?.codigoCidade ||
    header?.customer_codigo_ibge ||
    '3106200';

  const cUF = String(cMunFG).slice(0, 2) || '31';

  return `
    <ide>
      <cUF>${escapeXml(cUF)}</cUF>
      <cNF>${String(numero).padStart(8, '0').slice(-8)}</cNF>
      <natOp>${escapeXml(natureza)}</natOp>
      <mod>${mod}</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <dhEmi>${escapeXml(dhEmi)}</dhEmi>
      <dhSaiEnt>${escapeXml(dhEmi)}</dhSaiEnt>
      <tpNF>${tpNF}</tpNF>
      <idDest>${idDest}</idDest>
      <cMunFG>${escapeXml(cMunFG)}</cMunFG>
      <tpImp>${tpImp}</tpImp>
      <tpEmis>${tpEmis}</tpEmis>
      <cDV>0</cDV>
      <tpAmb>1</tpAmb>
      <finNFe>${finNFe}</finNFe>
      <indFinal>${indFinal}</indFinal>
      <indPres>${indPres}</indPres>
      <procEmi>${procEmi}</procEmi>
      <verProc>${escapeXml(verProc)}</verProc>
    </ide>
  `;
}

function buildEmitXml(nfeJson) {
  const emit = nfeJson?.emitente || {};
  const doc = onlyDigits(emit?.cpfCnpj || '');
  const isCnpj = doc.length === 14;

  const cnpjCpfTag = isCnpj
    ? `<CNPJ>${doc}</CNPJ>`
    : `<CPF>${doc || '00000000000'}</CPF>`;

  return `
    <emit>
      ${cnpjCpfTag}
      <xNome>${escapeXml(emit?.razaoSocial || 'EMITENTE')}</xNome>
      <xFant>${escapeXml(emit?.nomeFantasia || emit?.razaoSocial || 'EMITENTE')}</xFant>
      <enderEmit>
        <xLgr>${escapeXml(process.env.EMPRESA_LOGRADOURO || 'AV. BIAS FORTES')}</xLgr>
        <nro>${escapeXml(process.env.EMPRESA_NUMERO || '784')}</nro>
        <xBairro>${escapeXml(process.env.EMPRESA_BAIRRO || 'LOURDES')}</xBairro>
        <cMun>${escapeXml(process.env.EMPRESA_CODIGO_IBGE || '3106200')}</cMun>
        <xMun>${escapeXml(process.env.EMPRESA_CIDADE || 'BELO HORIZONTE')}</xMun>
        <UF>${escapeXml(process.env.EMPRESA_UF || 'MG')}</UF>
        <CEP>${escapeXml(onlyDigits(process.env.EMPRESA_CEP || '30170012'))}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        <fone>${escapeXml(onlyDigits(process.env.EMPRESA_FONE || '3135660070'))}</fone>
      </enderEmit>
      <IE>${escapeXml(onlyDigits(process.env.EMPRESA_IE || '0623221360087'))}</IE>
      <CRT>${escapeXml(process.env.EMPRESA_CRT || '3')}</CRT>
    </emit>
  `;
}

function buildDestXml(nfeJson) {
  const dest = nfeJson?.destinatario || {};
  const endereco = dest?.endereco || {};
  const doc = onlyDigits(dest?.cpfCnpj || '');
  const isCnpj = doc.length === 14;

  const cnpjCpfTag = isCnpj
    ? `<CNPJ>${doc}</CNPJ>`
    : `<CPF>${doc || '00000000000'}</CPF>`;

  const ieDest = String(dest?.indicadorIEDestinatario ?? '9');
  const ieTag =
    ieDest === '1' && dest?.inscricaoEstadual
      ? `<IE>${escapeXml(onlyDigits(dest.inscricaoEstadual))}</IE>`
      : ieDest === '2'
      ? `<IE>ISENTO</IE>`
      : '';

  const phoneDigits = onlyDigits(
    `${dest?.telefone?.ddd ?? ''}${dest?.telefone?.numero ?? ''}`
  );

  return `
    <dest>
      ${cnpjCpfTag}
      <xNome>${escapeXml(dest?.razaoSocial || 'CONSUMIDOR FINAL')}</xNome>
      <enderDest>
        <xLgr>${escapeXml(endereco?.logradouro || 'ENDERECO')}</xLgr>
        <nro>${escapeXml(endereco?.numero || 'S/N')}</nro>
        <xBairro>${escapeXml(endereco?.bairro || 'CENTRO')}</xBairro>
        <cMun>${escapeXml(endereco?.codigoCidade || '3106200')}</cMun>
        <xMun>${escapeXml(endereco?.descricaoCidade || 'BELO HORIZONTE')}</xMun>
        <UF>${escapeXml(endereco?.estado || 'MG')}</UF>
        <CEP>${escapeXml(onlyDigits(endereco?.cep || '30170012'))}</CEP>
        <cPais>${escapeXml(endereco?.codigoPais || '1058')}</cPais>
        <xPais>${escapeXml(endereco?.descricaoPais || 'Brasil')}</xPais>
        ${phoneDigits ? `<fone>${escapeXml(phoneDigits)}</fone>` : ''}
      </enderDest>
      <indIEDest>${escapeXml(ieDest)}</indIEDest>
      ${ieTag}
    </dest>
  `;
}

function buildDetXml(nfeJson) {
  const itens = asArray(nfeJson?.itens);

  return itens.map((item, idx) => {
    const nItem = idx + 1;
    const { qtd, vUnit, vProd, vDesc } = calcItemValues(item);

    const icms = item?.tributos?.icms || {};
    const pis = item?.tributos?.pis || {};
    const cofins = item?.tributos?.cofins || {};
    const ipi = item?.tributos?.ipi || {};

    const orig = String(icms?.origem ?? '0');
    const cstIcms = String(icms?.cst ?? '00');
    const cfop = String(item?.cfop ?? '5102');
    const ncm = onlyDigits(item?.ncm || '00000000');
    const cest = onlyDigits(item?.cest || '');
    const unidadeComercial = String(item?.unidadeComercial || 'UN').toUpperCase();
    const unidadeTributavel = String(item?.unidadeTributavel || unidadeComercial).toUpperCase();

    const vBC = Number(icms?.baseCalculo?.valor ?? 0) || 0;
    const pICMS = Number(icms?.aliquota ?? 0) || 0;
    const vICMS = Number(icms?.valor ?? 0) || 0;

    const pisCst = String(pis?.cst ?? '05');
    const vBCPis = Number(pis?.baseCalculo?.valor ?? 0) || 0;
    const pPIS = Number(pis?.aliquota ?? 0) || 0;
    const vPIS = Number(pis?.valor ?? 0) || 0;

    const cofinsCst = String(cofins?.cst ?? '05');
    const vBCCofins = Number(cofins?.baseCalculo?.valor ?? 0) || 0;
    const pCOFINS = Number(cofins?.aliquota ?? 0) || 0;
    const vCOFINS = Number(cofins?.valor ?? 0) || 0;

    const ipiCst = String(ipi?.cst ?? '');
    const vBCIpi = Number(ipi?.baseCalculo?.valor ?? 0) || 0;
    const pIPI = Number(ipi?.aliquota ?? 0) || 0;
    const vIPI = Number(ipi?.valor ?? 0) || 0;

    const icmsXml =
      cstIcms === '60'
        ? `
          <ICMS>
            <ICMS60>
              <orig>${escapeXml(orig)}</orig>
              <CST>${escapeXml(cstIcms)}</CST>
            </ICMS60>
          </ICMS>
        `
        : `
          <ICMS>
            <ICMS00>
              <orig>${escapeXml(orig)}</orig>
              <CST>${escapeXml(cstIcms)}</CST>
              <modBC>3</modBC>
              <vBC>${money2(vBC)}</vBC>
              <pICMS>${money4(pICMS)}</pICMS>
              <vICMS>${money2(vICMS)}</vICMS>
            </ICMS00>
          </ICMS>
        `;

    const pisXml =
      ['04', '05', '06', '07', '08', '09'].includes(pisCst)
        ? `
          <PIS>
            <PISNT>
              <CST>${escapeXml(pisCst)}</CST>
            </PISNT>
          </PIS>
        `
        : `
          <PIS>
            <PISAliq>
              <CST>${escapeXml(pisCst)}</CST>
              <vBC>${money2(vBCPis)}</vBC>
              <pPIS>${money4(pPIS)}</pPIS>
              <vPIS>${money2(vPIS)}</vPIS>
            </PISAliq>
          </PIS>
        `;

    const cofinsXml =
      ['04', '05', '06', '07', '08', '09'].includes(cofinsCst)
        ? `
          <COFINS>
            <COFINSNT>
              <CST>${escapeXml(cofinsCst)}</CST>
            </COFINSNT>
          </COFINS>
        `
        : `
          <COFINS>
            <COFINSAliq>
              <CST>${escapeXml(cofinsCst)}</CST>
              <vBC>${money2(vBCCofins)}</vBC>
              <pCOFINS>${money4(pCOFINS)}</pCOFINS>
              <vCOFINS>${money2(vCOFINS)}</vCOFINS>
            </COFINSAliq>
          </COFINS>
        `;

    const ipiXml = ipiCst
      ? `
        <IPI>
          <cEnq>999</cEnq>
          <IPITrib>
            <CST>${escapeXml(ipiCst)}</CST>
            <vBC>${money2(vBCIpi)}</vBC>
            <pIPI>${money4(pIPI)}</pIPI>
            <vIPI>${money2(vIPI)}</vIPI>
          </IPITrib>
        </IPI>
      `
      : '';

    return `
      <det nItem="${nItem}">
        <prod>
          <cProd>${escapeXml(item?.codigo || item?.sku || '')}</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>${escapeXml(item?.descricao || item?.description || '')}</xProd>
          <NCM>${escapeXml(ncm || '00000000')}</NCM>
          ${cest ? `<CEST>${escapeXml(cest)}</CEST>` : ''}
          <CFOP>${escapeXml(cfop)}</CFOP>
          <uCom>${escapeXml(unidadeComercial)}</uCom>
          <qCom>${money4(qtd)}</qCom>
          <vUnCom>${money4(vUnit)}</vUnCom>
          <vProd>${money2(vProd)}</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>${escapeXml(unidadeTributavel)}</uTrib>
          <qTrib>${money4(qtd)}</qTrib>
          <vUnTrib>${money4(vUnit)}</vUnTrib>
          ${vDesc > 0 ? `<vDesc>${money2(vDesc)}</vDesc>` : ''}
          <indTot>1</indTot>
        </prod>
        <imposto>
          ${icmsXml}
          ${pisXml}
          ${cofinsXml}
          ${ipiXml}
        </imposto>
      </det>
    `;
  }).join('\n');
}

function buildTotalXml(totals) {
  return `
    <total>
      <ICMSTot>
        <vBC>${money2(totals.vBC)}</vBC>
        <vICMS>${money2(totals.vICMS)}</vICMS>
        <vICMSDeson>${money2(totals.vICMSDeson)}</vICMSDeson>
        <vFCP>${money2(totals.vFCP)}</vFCP>
        <vBCST>${money2(totals.vBCST)}</vBCST>
        <vST>${money2(totals.vST)}</vST>
        <vFCPST>${money2(totals.vFCPST)}</vFCPST>
        <vFCPSTRet>${money2(totals.vFCPSTRet)}</vFCPSTRet>
        <vProd>${money2(totals.vProd)}</vProd>
        <vFrete>${money2(totals.vFrete)}</vFrete>
        <vSeg>${money2(totals.vSeg)}</vSeg>
        <vDesc>${money2(totals.vDesc)}</vDesc>
        <vII>${money2(totals.vII)}</vII>
        <vIPI>${money2(totals.vIPI)}</vIPI>
        <vIPIDevol>${money2(totals.vIPIDevol)}</vIPIDevol>
        <vPIS>${money2(totals.vPIS)}</vPIS>
        <vCOFINS>${money2(totals.vCOFINS)}</vCOFINS>
        <vOutro>${money2(totals.vOutro)}</vOutro>
        <vNF>${money2(totals.vNF)}</vNF>
        <vTotTrib>${money2(totals.vTotTrib)}</vTotTrib>
      </ICMSTot>
    </total>
  `;
}

function buildTranspXml() {
  return `
    <transp>
      <modFrete>9</modFrete>
    </transp>
  `;
}

function buildCobrancaXml(nfeJson) {
  const cobranca = nfeJson?.cobranca;
  if (!cobranca) return '';

  const parcelas = asArray(cobranca?.parcelas)
    .map((p) => `
      <dup>
        <nDup>${escapeXml(p?.numero || '001')}</nDup>
        <dVenc>${escapeXml(p?.dataVencimento || '')}</dVenc>
        <vDup>${money2(p?.valor || 0)}</vDup>
      </dup>
    `)
    .join('\n');

  return `
    <cobr>
      <fat>
        <nFat>${escapeXml(cobranca?.numero || '')}</nFat>
        <vOrig>${money2(cobranca?.valorTotal || 0)}</vOrig>
        <vLiq>${money2(cobranca?.valorLiquido || cobranca?.valorTotal || 0)}</vLiq>
      </fat>
      ${parcelas}
    </cobr>
  `;
}

function buildPagXml(nfeJson) {
  const pagamentos = asArray(nfeJson?.pagamentos);
  if (!pagamentos.length) return '';

  const dets = pagamentos.map((p) => {
    const tPag = String(p?.meio || '99').padStart(2, '0');
    return `
      <detPag>
        <tPag>${escapeXml(tPag)}</tPag>
        <vPag>${money2(p?.valor || 0)}</vPag>
      </detPag>
    `;
  }).join('\n');

  return `<pag>${dets}</pag>`;
}

function buildInfAdicXml(nfeJson) {
  const info = String(nfeJson?.informacoesComplementares || '').trim();
  if (!info) return '';
  return `
    <infAdic>
      <infCpl>${escapeXml(info)}</infCpl>
    </infAdic>
  `;
}

function buildProtPreviewXml(numero, dhEmi, chave = '') {
  const chNFe = onlyDigits(chave || '').padEnd(44, '0').slice(0, 44);

  return `
    <protNFe versao="4.00">
      <infProt>
        <tpAmb>1</tpAmb>
        <verAplic>CONSART-ERP-PREVIEW</verAplic>
        <chNFe>${escapeXml(chNFe)}</chNFe>
        <dhRecbto>${escapeXml(dhEmi)}</dhRecbto>
        <nProt>PREVIEW${String(numero).padStart(9, '0')}</nProt>
        <digVal>PREVIEW</digVal>
        <cStat>100</cStat>
        <xMotivo>AUTORIZADO O USO DA NF-E - PREVIEW</xMotivo>
      </infProt>
    </protNFe>
  `;
}

function buildPreviewXmlFromNfeJson({ nfeJson, header }) {
  const numero = extractNumero(nfeJson, header);
  const serie = extractSerie(nfeJson, header);
  const dhEmi = formatDhEmi(
    nfeJson?.dataHoraSaidaEntrada ||
    header?.nfe_issue_date ||
    header?.issue_date
  );
  const chave = header?.nfe_key || '';
  const totals = sumNfeTotals(nfeJson);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe${escapeXml(onlyDigits(chave).padEnd(44, '0').slice(0, 44))}" versao="4.00">
      ${buildIdeXml(nfeJson, numero, serie, dhEmi, header)}
      ${buildEmitXml(nfeJson)}
      ${buildDestXml(nfeJson)}
      ${buildDetXml(nfeJson)}
      ${buildTotalXml(totals)}
      ${buildTranspXml()}
      ${buildCobrancaXml(nfeJson)}
      ${buildPagXml(nfeJson)}
      ${buildInfAdicXml(nfeJson)}
    </infNFe>
  </NFe>
  ${buildProtPreviewXml(numero, dhEmi, chave)}
</nfeProc>`;

  return { xml, numero, serie, chave };
}

/* ──────────────────────────────────────────────────────────────
 * Payment helpers
 * ────────────────────────────────────────────────────────────── */
function mapPaymentMethodToTPag(payment = {}) {
  const type = String(payment?.payment_method_type || '').trim().toLowerCase();
  const name = String(payment?.payment_method_name || '').trim().toLowerCase();

  if (type.includes('pix') || name.includes('pix')) return '17';
  if (type.includes('boleto') || name.includes('boleto')) return '15';
  if (type.includes('dinheiro') || name.includes('dinheiro') || name.includes('espécie')) return '01';
  if (type.includes('cartao_credito') || type.includes('cartão_credito') || name.includes('crédito')) return '03';
  if (type.includes('cartao_debito') || type.includes('cartão_débito') || name.includes('débito')) return '04';
  if (type.includes('transferencia') || type.includes('transferência') || name.includes('transferência')) return '16';
  if (type.includes('sem_pagamento')) return '90';

  return '99';
}

function appendComplementaryInfo(baseInfo, extraInfo) {
  const a = String(baseInfo || '').trim();
  const b = String(extraInfo || '').trim();

  if (a && b) return `${a} ${b}`;
  return a || b || '';
}

function normalizePaymentsIntoNfeJson(nfeJson, paymentPayload) {
  const payments = Array.isArray(paymentPayload?.payments) ? paymentPayload.payments : [];
  const installments = Array.isArray(paymentPayload?.installments) ? paymentPayload.installments : [];
  const paymentObservation = String(paymentPayload?.payment_observation || '').trim();

  if (!payments.length && !installments.length && !paymentObservation) {
    return nfeJson;
  }

  const normalizedPagamentos = payments.map((p) => ({
    meio: mapPaymentMethodToTPag(p),
    valor: Number(p?.amount || 0),
    descricao: p?.payment_method_name || null,
  }));

  const parcelas = installments.length
    ? installments.map((inst) => ({
        numero: String(inst?.installment_number ?? 1).padStart(3, '0'),
        dataVencimento: inst?.due_date ? String(inst.due_date).slice(0, 10) : '',
        valor: Number(inst?.amount || 0),
      }))
    : payments.map((p, index) => ({
        numero: String(index + 1).padStart(3, '0'),
        dataVencimento: '',
        valor: Number(p?.amount || 0),
      }));

  const valorTotal = payments.reduce((acc, p) => acc + Number(p?.amount || 0), 0);

  return {
    ...nfeJson,
    pagamentos: normalizedPagamentos,
    cobranca: {
      numero: String(nfeJson?.numero || ''),
      valorTotal,
      valorLiquido: valorTotal,
      parcelas,
    },
    informacoesComplementares: appendComplementaryInfo(
      nfeJson?.informacoesComplementares,
      paymentObservation
    ),
  };
}

/* ──────────────────────────────────────────────────────────────
 * Controller
 * ────────────────────────────────────────────────────────────── */
export async function previewOrderPdf(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'Parâmetro :id inválido.',
      });
    }

    const out = await ordersApi.getById(id);

    if (!out?.ok) {
      const code = out?.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json({
        ok: false,
        error: out?.error || 'Pedido não encontrado.',
      });
    }

    const header = out.header || {};
    const items = Array.isArray(out.items) ? out.items : [];

    if (!items.length) {
      return res.status(400).json({
        ok: false,
        error: 'Pedido não possui itens para gerar preview da NF-e.',
      });
    }

    // ✅ Busca pagamentos reais do orçamento vinculado ao pedido
    const paymentPayload = await ordersApi.getNfePaymentPayload(id);
    if (!paymentPayload?.ok) {
      return res.status(400).json({
        ok: false,
        error: paymentPayload?.error || 'Falha ao carregar pagamentos do pedido.',
      });
    }

    let nfeJson = await tecnospeedNfeApi.buildNFeFromOrder({
      header,
      items,
    });

    // ✅ Injeta pagamentos reais no JSON da NF-e antes de gerar o XML preview
    nfeJson = normalizePaymentsIntoNfeJson(nfeJson, paymentPayload);

    const { xml, numero, serie, chave } = buildPreviewXmlFromNfeJson({
      nfeJson,
      header,
    });

    const paymentText =
      Array.isArray(paymentPayload?.payment_lines) && paymentPayload.payment_lines.length
        ? paymentPayload.payment_lines.join(' | ')
        : Array.isArray(nfeJson?.pagamentos) && nfeJson.pagamentos.length
        ? nfeJson.pagamentos
            .map((p) => {
              const meio = String(p?.meio || '99').padStart(2, '0');
              const valor = money2(p?.valor || 0);
              const descricao = String(p?.descricao || '').trim();
              return descricao
                ? `${descricao}: R$ ${valor}`
                : `TPAG ${meio} - R$ ${valor}`;
            })
            .join(' | ')
        : null;

    const { buffer, filename } = await generateDanfeFromXml({
      numero,
      serie,
      chave,
      xmlContent: xml,
      prot: {
        status: 'PREVIEW',
        nfe_status: 'PREVIEW',
      },
      paymentText,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename || `preview-nfe-pedido-${id}.pdf`}"`
    );

    return res.send(buffer);
  } catch (err) {
    console.error('[previewOrderPdf] erro:', err);

    return res.status(500).json({
      ok: false,
      error: 'Falha ao gerar preview da NF-e do pedido.',
      details: err?.message || String(err),
    });
  }
}

export default {
  previewOrderPdf,
};