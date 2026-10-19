// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeList.repository.js — Listagem de NF-e                   ║
// ║ ✔ listarNFe (consulta por período + resumo)                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  api,
  refreshApiConfig,
} from './tecnoSpeedNfeClient.repository.js';
import {
  sanitizeCpfCnpj,
} from '../nfe/nfe.sanitizers.js';

/* =========================================================================
 * 📋 Listar NF-e
 * ========================================================================= */
export async function listarNFe({
  page = 1,
  pageSize = 20,
  q = '',
  dateFrom,
  dateTo,
} = {}) {
  refreshApiConfig();

  const cnpj = sanitizeCpfCnpj(process.env.EMPRESA_CNPJ);
  if (!cnpj) {
    return { ok: false, status: 400, error: 'EMPRESA_CNPJ ausente no .env' };
  }

  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const defTo = fmt(today);
  const dFrom = new Date(today);
  dFrom.setDate(dFrom.getDate() - 90);
  const defFrom = fmt(dFrom);

  const dataInicial = dateFrom || defFrom;
  const dataFinal = dateTo || defTo;

  const qTrim = String(q || '').trim();
  const qNorm = qTrim.toLowerCase();

  const digitsOnlyLocal = (v) => String(v || '').replace(/\D+/g, '');
  const safeStr = (v) => (v == null ? '' : String(v));
  const includesNorm = (v) => safeStr(v).toLowerCase().includes(qNorm);

  function matchQ(it) {
    if (!qNorm) return true;

    const idIntegracao = it?.idIntegracao ?? it?.idintegracao ?? it?.id ?? it?._id;
    const chave =
      it?.chaveAcesso ??
      it?.chave_acesso ??
      it?.chave ??
      it?.chaveNfe ??
      it?.chaveNFe ??
      it?.chaveNFE;

    const numero =
      it?.numero ??
      it?.numeroNfe ??
      it?.numeroNF ??
      it?.numNfe ??
      it?.nfeNumero ??
      it?.nfe_number;

    const protocolo =
      it?.protocolo ?? it?.protocoloAutorizacao ?? it?.protocoloSefaz;

    const dest = it?.destinatario || it?.cliente || it?.tomador || it?.dest || {};
    const cliNome =
      dest?.razaoSocial || dest?.nome || it?.clienteNome || it?.razaoSocial;
    const cliDoc =
      dest?.cpfCnpj || dest?.documento || it?.cpfCnpj || it?.cnpjCpf;

    const refPedido =
      it?.referencia?.numeroPedido ??
      it?.referencia?.pedido ??
      it?.numeroPedido ??
      it?.pedido ??
      it?.orderId ??
      it?.order_id;

    const qDigits = digitsOnlyLocal(qTrim);
    const cliDigits = digitsOnlyLocal(cliDoc);
    const chaveDigits = digitsOnlyLocal(chave);

    if (includesNorm(idIntegracao)) return true;
    if (includesNorm(chave)) return true;
    if (includesNorm(numero)) return true;
    if (includesNorm(protocolo)) return true;
    if (includesNorm(cliNome)) return true;
    if (includesNorm(cliDoc)) return true;
    if (includesNorm(refPedido)) return true;

    if (qDigits) {
      if (cliDigits && cliDigits.includes(qDigits)) return true;
      if (chaveDigits && chaveDigits.includes(qDigits)) return true;
      if (digitsOnlyLocal(numero).includes(qDigits)) return true;
      if (digitsOnlyLocal(refPedido).includes(qDigits)) return true;
      if (digitsOnlyLocal(idIntegracao).includes(qDigits)) return true;
    }

    return false;
  }

  const looksLikeIdIntegracao =
    qTrim &&
    (/^\d{6,}$/.test(qTrim) ||
      /^[a-f0-9]{24}$/i.test(qTrim) ||
      /^[A-Za-z0-9\-_]{8,}$/.test(qTrim)) &&
    !/[^\w\-]/.test(qTrim);

  if (looksLikeIdIntegracao) {
    try {
      const resResumo = await api.get(
        `/nfe/${cnpj}/${encodeURIComponent(qTrim)}/resumo`,
      );
      const doc = resResumo.data ? [resResumo.data] : [];
      return {
        ok: true,
        status: resResumo.status,
        data: doc,
        total: doc.length,
        meta: { directIdIntegracao: qTrim },
      };
    } catch (e) {
      const st = e.response?.status;
      if (st && st !== 404) {
        return { ok: false, status: st, error: e.response?.data || e.message };
      }
    }
  }

  try {
    const res = await api.get('/nfe/consulta/periodo', {
      params: {
        cpfCnpj: cnpj,
        dataInicial,
        dataFinal,
        page,
        pageSize,
        pagina: page,
        tamanhoPagina: pageSize,
        perPage: pageSize,
        limit: pageSize,
        offset: (Math.max(1, page) - 1) * Math.max(1, pageSize),
      },
    });

    let itens = Array.isArray(res.data?.itens)
      ? res.data.itens
      : Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.docs)
          ? res.data.docs
          : Array.isArray(res.data?.items)
            ? res.data.items
            : [];

    const apiTotal =
      Number(res.data?.total ?? res.data?.count ?? res.data?.totalRegistros ?? 0) ||
      0;

    if (qNorm) itens = itens.filter(matchQ);

    const total = apiTotal || itens.length;
    const start = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const end = start + Math.max(1, pageSize);
    const pageItems = itens.slice(start, end);

    return {
      ok: true,
      status: res.status,
      data: pageItems,
      total,
      meta: {
        dateFrom: dataInicial,
        dateTo: dataFinal,
        cnpj,
        paginated: true,
        filtered: !!qNorm,
      },
    };
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || err.message;
    return { ok: false, status, error: data };
  }
}
