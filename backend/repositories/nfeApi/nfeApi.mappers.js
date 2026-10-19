// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeApi.mappers.js — conversões TecnoSpeed ⇄ NF-e API                 ║
// ║ ✔ JSON PlugNotas (buildNFeFromOrder) → corpo POST /v1/invoices       ║
// ║ ✔ Registro da NF-e API → "documento" lido por nfeIssuance.provider   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { getBaseUrl, toErpEnvironment } from './nfeApiClient.repository.js';

const digits = (value) => String(value ?? '').replace(/\D/g, '');
const text = (value, max) => {
  const clean = String(value ?? '').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, max) : undefined;
};
const num = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value));

/** Grupos que a NF-e API ainda não gera: falhar alto em vez de emitir XML incompleto. */
export class UnsupportedNfeFieldError extends Error {
  constructor(message) {
    super(message);
    this.status = 422;
    this.code = 'NFE_API_UNSUPPORTED_FIELD';
  }
}

/* =========================================================================
 * 📤 PlugNotas → NF-e API
 * ========================================================================= */

function mapAddress(endereco = {}) {
  return {
    street: text(endereco.logradouro, 60),
    number: text(endereco.numero, 60) || 'SN',
    complement: text(endereco.complemento, 60),
    district: text(endereco.bairro, 60),
    cityCode: digits(endereco.codigoCidade),
    city: text(endereco.descricaoCidade, 60),
    state: String(endereco.estado || endereco.uf || '').toUpperCase(),
    zipCode: digits(endereco.cep) || undefined,
  };
}

function mapCustomer(destinatario = {}) {
  const doc = digits(destinatario.cpfCnpj);
  const indicator = num(destinatario.indicadorIEDestinatario ?? destinatario.indicadorInscricaoEstadual) ?? 9;
  return {
    ...(doc.length === 11 ? { cpf: doc } : { cnpj: doc }),
    name: text(destinatario.razaoSocial || destinatario.nome, 60),
    stateRegistrationIndicator: indicator,
    ...(indicator === 1 && destinatario.inscricaoEstadual ? { stateRegistration: digits(destinatario.inscricaoEstadual) } : {}),
    ...(destinatario.email ? { email: text(destinatario.email, 60) } : {}),
    ...(destinatario.endereco ? { address: mapAddress(destinatario.endereco) } : {}),
  };
}

function mapIcms(icms = {}, sku) {
  const code = String(icms.csosn ?? icms.cst ?? '');
  const result = code.length === 3 ? { csosn: code } : { cst: code };

  if (icms.aliquota !== undefined) result.rate = Number(icms.aliquota);
  if (icms.baseCalculo?.valor !== undefined) result.baseValue = Number(icms.baseCalculo.valor);
  if (icms.valor !== undefined && code !== '60') result.value = Number(icms.valor);

  const st = icms.substituicaoTributaria;
  if (code === '60' && st) {
    result.retained = {
      baseValue: Number(st.baseCalculo?.valor ?? 0), // vBCSTRet
      rate: Number(st.aliquota ?? 0), // pST
      substituteValue: Number(icms.valor ?? 0), // vICMSSubstituto
      value: Number(st.valor ?? 0), // vICMSSTRet
    };
    const fcp = st.fundoCombatePobreza;
    if (fcp?.valor) {
      Object.assign(result.retained, {
        fcpBaseValue: Number(fcp.baseCalculo?.valor ?? fcp.baseCalculo ?? 0),
        fcpRate: Number(fcp.aliquota ?? 0),
        fcpValue: Number(fcp.valor),
      });
    }
  } else if (st && code !== '60') {
    throw new UnsupportedNfeFieldError(
      `SKU ${sku}: ICMS-ST com CST ${code} ainda não é suportado pela NF-e API. Use NFE_PROVIDER=tecnospeed para esta nota.`,
    );
  }
  return result;
}

function mapPisCofins(tax = {}) {
  return {
    cst: String(tax.cst ?? ''),
    ...(tax.aliquota !== undefined ? { rate: Number(tax.aliquota) } : {}),
    ...(tax.baseCalculo?.valor !== undefined ? { baseValue: Number(tax.baseCalculo.valor) } : {}),
    ...(tax.valor !== undefined ? { value: Number(tax.valor) } : {}),
  };
}

function mapIbsCbs(ibs) {
  if (!ibs) return undefined;
  return {
    cst: String(ibs.cst).padStart(3, '0'),
    classCode: String(ibs.classificacao),
    baseValue: num(ibs.baseCalculo),
    ibsStateRate: Number(ibs.uf?.aliquota ?? 0),
    ibsMunicipalRate: Number(ibs.municipio?.aliquota ?? 0),
    cbsRate: Number(ibs.cbs?.aliquota ?? 0),
    ...((ibs.uf?.reducao ?? ibs.cbs?.reducao)
      ? { reductionRate: Number((ibs.uf?.reducao ?? ibs.cbs?.reducao).aliquota) }
      : {}),
  };
}

function mapItem(item) {
  const tributos = item.tributos ?? {};
  if (tributos.ipi) {
    throw new UnsupportedNfeFieldError(
      `SKU ${item.codigo}: IPI ainda não é suportado pela NF-e API. Use NFE_PROVIDER=tecnospeed para esta nota.`,
    );
  }
  return {
    code: text(item.codigo, 60),
    description: text(item.descricao, 120),
    ncm: digits(item.ncm),
    ...(item.cest ? { cest: digits(item.cest) } : {}),
    cfop: digits(item.cfop),
    unit: text(item.unidade?.comercial, 6),
    taxableUnit: text(item.unidade?.tributavel, 6),
    quantity: Number(item.quantidade?.comercial),
    unitPrice: Number(item.valorUnitario?.comercial),
    ...(item.valorDesconto ? { discount: Number(item.valorDesconto) } : {}),
    ...(item.valorFrete ? { freight: Number(item.valorFrete) } : {}),
    origin: Number(tributos.icms?.origem ?? 0),
    icms: mapIcms(tributos.icms, item.codigo),
    pis: mapPisCofins(tributos.pis),
    cofins: mapPisCofins(tributos.cofins),
    ...(tributos.ibscbs ? { ibsCbs: mapIbsCbs(tributos.ibscbs) } : {}),
  };
}

function mapTransport(transporte = {}) {
  const t = transporte.transportador;
  const volumes = (transporte.volumes ?? []).map((v) => ({
    quantity: num(v.quantidade),
    kind: text(v.especie, 60),
    brand: text(v.marca, 60),
    numbering: text(v.numeracao, 60),
    ...(v.pesoLiquido ? { netWeight: Number(v.pesoLiquido) } : {}),
    ...(v.pesoBruto ? { grossWeight: Number(v.pesoBruto) } : {}),
  }));
  return {
    freightMode: Number(transporte.modalidadeFrete ?? 9),
    ...(t ? {
      carrier: {
        cnpj: t.cnpj,
        cpf: t.cpf,
        name: text(t.nome, 60),
        stateRegistration: t.inscricaoEstadual,
        address: text(t.endereco?.logradouro, 60),
        city: text(t.endereco?.descricaoCidade, 60),
        state: t.endereco?.uf,
      },
    } : {}),
    ...(volumes.length ? { volumes } : {}),
  };
}

function mapBilling(cobranca, numero) {
  if (!cobranca) return undefined;
  const installments = (cobranca.parcelas ?? []).map((p, index) => ({
    number: String(p.numero ?? index + 1).replace(/\D/g, '').slice(-3) || String(index + 1),
    dueDate: String(p.dataVencimento).slice(0, 10),
    amount: Number(p.valor),
  }));
  // Sem número reservado (homologação numerada pela API) o builder pode mandar "null"
  const invoiceNumber = [cobranca.numero, numero].map((v) => String(v ?? '')).find((v) => /^\d+$/.test(v));
  return {
    ...(invoiceNumber ? { invoiceNumber } : {}),
    originalValue: num(cobranca.valorTotal ?? cobranca.valorOriginal),
    discount: num(cobranca.valorDesconto) ?? 0,
    netValue: num(cobranca.valorLiquido),
    installments,
  };
}

/** JSON do buildNFeFromOrder (formato PlugNotas) → corpo do POST /v1/invoices. */
export function toApiInvoicePayload(nfe) {
  return {
    issuerCnpj: digits(nfe.emitente?.cpfCnpj),
    externalId: nfe.idIntegracao,
    series: Number(nfe.serie ?? 1),
    // Número reservado pelo ERP (public.nfe). Ausente = a NF-e API numera (homologação).
    ...(Number(nfe.numero) > 0 ? { number: Number(nfe.numero) } : {}),
    operationNature: text(nfe.natureza, 60),
    operationType: nfe.saida === false ? 0 : 1,
    purpose: Number(nfe.finalidade ?? 1),
    presence: Number(nfe.presencial ?? 1),
    finalConsumer: Boolean(nfe.consumidorFinal),
    customer: mapCustomer(nfe.destinatario),
    items: (nfe.itens ?? []).map(mapItem),
    ...mapTransport(nfe.transporte),
    ...(nfe.cobranca ? { billing: mapBilling(nfe.cobranca, nfe.numero) } : {}),
    payments: (nfe.pagamentos ?? []).map((p) => ({
      method: String(p.meio).padStart(2, '0'),
      amount: Number(p.valor),
      paymentIndicator: p.aVista === false ? 1 : 0,
      ...(p.descricaoMeio ? { description: text(p.descricaoMeio, 60) } : {}),
    })),
    ...(nfe.valorTroco > 0 ? { change: Number(nfe.valorTroco) } : {}),
    ...(nfe.informacoesComplementares ? { additionalInfo: text(nfe.informacoesComplementares, 5000) } : {}),
  };
}

/* =========================================================================
 * 📥 NF-e API → "documento" PlugNotas
 * ========================================================================= */

const STATUS = {
  authorized: 'AUTORIZADA',
  rejected: 'REJEITADA',
  denied: 'DENEGADA',
  cancelled: 'CANCELADA',
  processing: 'PROCESSANDO',
  unknown: 'PROCESSANDO',
  signed: 'PROCESSANDO',
};

/** "2026-09-29T08:01:15-03:00" → "29/09/2026" (formato que o ERP já interpreta). */
const brDate = (iso) => {
  const match = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : undefined;
};

export function toProviderDocument(record) {
  return {
    id: record.accessKey, // gravado como provider_id; usado depois em XML/PDF/cancelamento
    idIntegracao: record.externalId,
    chave: record.accessKey,
    numero: record.number,
    serie: record.series,
    status: STATUS[record.status] ?? String(record.status || '').toUpperCase(),
    protocolo: record.protocolNumber ?? null,
    mensagem: record.statusCode ? `${record.statusCode} - ${record.statusReason}` : (record.lastError ?? null),
    ambiente: toErpEnvironment(record.environment),
    emissao: brDate(record.issuedAt),
    dataAutorizacao: brDate(record.authorizedAt),
    valor: record.totalValue,
    // Mesmos campos da PlugNotas (gravados em invoicesIssued.xml_url/danfe_url e usados pelo DANFE de pedidos).
    // Exigem o cabeçalho x-api-key da NF-e API (nfeApiAuthHeaders).
    ...(['authorized', 'cancelled'].includes(record.status)
      ? { xml: `${getBaseUrl()}/v1/invoices/${record.accessKey}/xml`, pdf: `${getBaseUrl()}/v1/invoices/${record.accessKey}/pdf` }
      : {}),
    ...(record.cancellation ? {
      dataCancelamento: brDate(record.cancellation.registeredAt) ?? brDate(record.updatedAt),
      protocoloCancelamento: record.cancellation.protocolNumber ?? null,
    } : {}),
  };
}
