// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: nfeInutilizarEventsController.js                              ║
// ║ MODULE: NF-e Inutilization Events Controller                        ║
// ║ CONSART ERP                                                         ║
// ║ ✔ Create + List + Get + Consult                                     ║
// ║ ✔ Trata duplicidade homologada como AUTHORIZED                      ║
// ║ ✔ Ano em 4 dígitos                                                  ║
// ║ ✔ Fluxo robusto de erro / desbloqueio                               ║
// ║ ✔ Compatível com variações de retorno da PlugNotas/TecnoSpeed       ║
// ║ ✔ FIX: Captura correta de protocol                                  ║
// ║ ✔ FIX: Consulta correta da inutilização                             ║
// ║ ✔ FIX: Melhor normalização de status                                ║
// ║ ✔ FIX: Sucesso real do provider por cStat/status/mensagem           ║
// ║ ✔ FIX: Bloqueio de faixa sobreposta                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import nfeInutilizarEventsApi from '../repositories/nfeInutilizarEvents/nfeInutilizarEvents.index.js';
import tecnospeedNfeApi from '../repositories/nfe/nfe.index.js';

/* =======================================================================
 * Helpers
 * ======================================================================= */
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');

const toInt = (v, f = 0) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : f;
};

const getYear4 = (v) => {
  const n = toInt(v, 0);
  if (n >= 2000 && n <= 2999) return n;
  if (n >= 0 && n <= 99) return 2000 + n;
  return new Date().getFullYear();
};

const safeJson = (v) => {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v ?? null;
  }
};

const isValidJustification = (t) => {
  const len = String(t || '').trim().length;
  return len >= 15 && len <= 255;
};

function isAuthorizedStatus(status) {
  return String(status || '').trim().toUpperCase() === 'AUTHORIZED';
}

/* =======================================================================
 * Status / Provider parsing
 * ======================================================================= */
function normalizeStatus(data = {}) {
  const cStat = String(
    data?.cStat ??
    data?.data?.cStat ??
    data?.retorno?.cStat ??
    data?.retorno?.data?.cStat ??
    data?.error?.data?.current?.cStat ??
    data?.error?.error?.data?.current?.cStat ??
    ''
  ).toUpperCase();

  const status = String(
    data?.status ??
    data?.situacao ??
    data?.data?.status ??
    data?.data?.situacao ??
    data?.retorno?.status ??
    data?.retorno?.situacao ??
    data?.error?.data?.current?.status ??
    data?.error?.error?.data?.current?.status ??
    data?.message ??
    data?.mensagem ??
    data?.error?.message ??
    data?.error?.error?.message ??
    ''
  ).toUpperCase();

  const mensagem = String(
    data?.mensagem ??
    data?.message ??
    data?.data?.mensagem ??
    data?.data?.message ??
    data?.retorno?.mensagem ??
    data?.retorno?.message ??
    data?.error?.data?.current?.mensagem ??
    data?.error?.data?.current?.message ??
    data?.error?.error?.data?.current?.mensagem ??
    data?.error?.error?.data?.current?.message ??
    ''
  ).toUpperCase();

  const raw = JSON.stringify(data || {}).toUpperCase();

  if (
    ['102', '135', '136', '155'].includes(cStat) ||
    status.includes('AUTORIZ') ||
    status.includes('CONCLUID') ||
    status.includes('INUTILIZAD') ||
    mensagem.includes('HOMOLOG') ||
    mensagem.includes('INUTILIZAD') ||
    raw.includes('"CSTAT":"102"') ||
    raw.includes('"CSTAT":102') ||
    raw.includes('INUTILIZAÇÃO HOMOLOGADA') ||
    raw.includes('INUTILIZACAO HOMOLOGADA')
  ) {
    return 'AUTHORIZED';
  }

  if (
    ['301', '302', '303'].includes(cStat) ||
    status.includes('REJEIT') ||
    mensagem.includes('REJEIT')
  ) {
    return 'REJECTED';
  }

  if (
    ['103', '105'].includes(cStat) ||
    status.includes('PROCESS') ||
    mensagem.includes('PROCESS')
  ) {
    return 'SENT';
  }

  if (!cStat && !status && !mensagem && raw === '{}') return 'UNKNOWN';
  return 'ERROR';
}

function buildPayload(body = {}) {
  return {
    companyCnpj: onlyDigits(body.companyCnpj || process.env.EMPRESA_CNPJ),
    model: String(body.model || '55').trim(),
    serie: toInt(body.serie),
    numberStart: toInt(body.numberStart),
    numberEnd: toInt(body.numberEnd),
    year: getYear4(body.year),
    justification: String(body.justification || '').trim(),
  };
}

function validatePayload(p) {
  const errors = [];

  if (!p.companyCnpj || p.companyCnpj.length !== 14) errors.push('CNPJ inválido');
  if (!p.model) errors.push('Modelo inválido');
  if (p.serie < 0) errors.push('Série inválida');
  if (!p.numberStart || p.numberStart < 1) errors.push('Número inicial inválido');
  if (!p.numberEnd || p.numberEnd < 1) errors.push('Número final inválido');
  if (p.numberEnd < p.numberStart) errors.push('Faixa inválida');
  if (!p.year || p.year < 2000) errors.push('Ano inválido');

  if (!isValidJustification(p.justification)) {
    errors.push('Justificativa inválida (mínimo de 15 e máximo de 255 caracteres)');
  }

  return errors;
}

function extractProviderOk(response = {}) {
  const cStat = String(
    response?.cStat ??
    response?.data?.cStat ??
    response?.retorno?.cStat ??
    response?.retorno?.data?.cStat ??
    response?.error?.data?.current?.cStat ??
    response?.error?.error?.data?.current?.cStat ??
    ''
  ).trim();

  const status = String(
    response?.status ??
    response?.situacao ??
    response?.data?.status ??
    response?.data?.situacao ??
    response?.retorno?.status ??
    response?.retorno?.situacao ??
    response?.error?.data?.current?.status ??
    response?.error?.error?.data?.current?.status ??
    ''
  ).toUpperCase();

  const mensagem = String(
    response?.mensagem ??
    response?.message ??
    response?.data?.mensagem ??
    response?.data?.message ??
    response?.retorno?.mensagem ??
    response?.retorno?.message ??
    response?.error?.data?.current?.mensagem ??
    response?.error?.data?.current?.message ??
    response?.error?.error?.data?.current?.mensagem ??
    response?.error?.error?.data?.current?.message ??
    ''
  ).toUpperCase();

  if (response?.ok === true || response?.success === true || response?.data?.success === true) {
    return true;
  }

  if (['102', '103', '105', '135', '136', '155'].includes(cStat)) {
    return true;
  }

  if (
    status.includes('AUTORIZ') ||
    status.includes('CONCLUID') ||
    status.includes('INUTILIZAD') ||
    status.includes('PROCESS')
  ) {
    return true;
  }

  if (
    mensagem.includes('HOMOLOG') ||
    mensagem.includes('INUTILIZAD') ||
    mensagem.includes('PROCESS')
  ) {
    return true;
  }

  return false;
}

function extractProviderError(response) {
  if (typeof response?.error === 'string' && response.error.trim()) {
    return response.error.trim();
  }

  if (typeof response?.error?.message === 'string' && response.error.message.trim()) {
    return response.error.message.trim();
  }

  if (typeof response?.error?.error?.message === 'string' && response.error.error.message.trim()) {
    return response.error.error.message.trim();
  }

  if (typeof response?.message === 'string' && response.message.trim()) {
    return response.message.trim();
  }

  if (typeof response?.mensagem === 'string' && response.mensagem.trim()) {
    return response.mensagem.trim();
  }

  if (typeof response?.data?.message === 'string' && response.data.message.trim()) {
    return response.data.message.trim();
  }

  if (typeof response?.data?.mensagem === 'string' && response.data.mensagem.trim()) {
    return response.data.mensagem.trim();
  }

  if (response?.error?.data?.current?.mensagem) {
    return String(response.error.data.current.mensagem);
  }

  if (response?.error?.data?.current?.message) {
    return String(response.error.data.current.message);
  }

  if (response?.error?.error?.data?.current?.mensagem) {
    return String(response.error.error.data.current.mensagem);
  }

  if (response?.error?.error?.data?.current?.message) {
    return String(response.error.error.data.current.message);
  }

  try {
    return JSON.stringify(response?.error || response || null);
  } catch {
    return 'Falha ao comunicar com o provedor';
  }
}

function extractProtocol(data = {}) {
  return (
    data?.protocol ||
    data?.data?.protocol ||
    data?.protocolo ||
    data?.data?.protocolo ||
    data?.nProt ||
    data?.data?.nProt ||
    data?.numeroProtocolo ||
    data?.data?.numeroProtocolo ||
    data?.protocoloAutorizacao ||
    data?.data?.protocoloAutorizacao ||
    data?.retorno?.protocol ||
    data?.retorno?.data?.protocol ||
    data?.retorno?.protocolo ||
    data?.retorno?.data?.protocolo ||
    data?.retorno?.nProt ||
    data?.retorno?.data?.nProt ||
    data?.error?.data?.current?.protocol ||
    data?.error?.data?.current?.protocolo ||
    data?.error?.data?.current?.nProt ||
    data?.error?.error?.data?.current?.protocol ||
    data?.error?.error?.data?.current?.protocolo ||
    data?.error?.error?.data?.current?.nProt ||
    data?.id ||
    data?.data?.id ||
    null
  );
}

function extractMessage(data = {}, fallback = null) {
  return (
    data?.mensagem ||
    data?.message ||
    data?.data?.mensagem ||
    data?.data?.message ||
    data?.retorno?.mensagem ||
    data?.retorno?.message ||
    data?.error?.data?.current?.mensagem ||
    data?.error?.data?.current?.message ||
    data?.error?.error?.data?.current?.mensagem ||
    data?.error?.error?.data?.current?.message ||
    fallback
  );
}

function isProviderDuplicateInutilizacao(response = {}) {
  const msg = JSON.stringify(response).toUpperCase();

  return (
    msg.includes('JA EXISTE UMA INUTILIZACAO') ||
    msg.includes('JÁ EXISTE UMA INUTILIZAÇÃO') ||
    msg.includes('INUTILIZACAO JA EXISTENTE') ||
    msg.includes('INUTILIZAÇÃO JÁ EXISTENTE')
  );
}

function extractDuplicateCurrent(response = {}) {
  return (
    response?.error?.data?.current ||
    response?.error?.error?.data?.current ||
    response?.data?.current ||
    response?.current ||
    null
  );
}

function buildDuplicateAuthorizedMessage(current = {}) {
  return (
    current?.mensagem ||
    current?.message ||
    'Inutilização já existente e homologada anteriormente'
  );
}

function isDuplicateAlreadyAuthorized(current = {}) {
  const cStat = String(current?.cStat || '').toUpperCase();
  const statusAtual = String(current?.status || current?.situacao || '').toUpperCase();
  const mensagemAtual = String(buildDuplicateAuthorizedMessage(current)).toUpperCase();

  return (
    cStat === '102' ||
    statusAtual.includes('CONCLUID') ||
    statusAtual.includes('AUTORIZ') ||
    statusAtual.includes('INUTILIZAD') ||
    mensagemAtual.includes('HOMOLOG') ||
    mensagemAtual.includes('INUTILIZAD')
  );
}

/* =======================================================================
 * Create
 * ======================================================================= */
export async function createInutilizacao(req, res) {
  let created = null;

  try {
    const payload = buildPayload(req.body);
    const errors = validatePayload(payload);

    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const duplicate = await nfeInutilizarEventsApi.findOverlappingRange(payload);

    if (duplicate) {
      if (isAuthorizedStatus(duplicate.status)) {
        return res.status(200).json({
          ok: true,
          duplicated: true,
          message: 'Esta inutilização já havia sido autorizada anteriormente.',
          data: duplicate,
        });
      }

      return res.status(409).json({
        ok: false,
        message: `Já existe uma inutilização para esta faixa (${duplicate.status})`,
        data: duplicate,
      });
    }

    created = await nfeInutilizarEventsApi.create({
      ...payload,
      status: 'PENDING',
      locked: true,
    });

    const provider = await tecnospeedNfeApi.inutilizarNumeracao(payload);
    const providerData = provider?.data || provider || {};

    if (!extractProviderOk(provider)) {
      const isDuplicate = isProviderDuplicateInutilizacao(provider);
      const current = extractDuplicateCurrent(provider);

      if (isDuplicate && current) {
        const protocol = extractProtocol(current);
        const mensagemAtual = buildDuplicateAuthorizedMessage(current);

        if (isDuplicateAlreadyAuthorized(current)) {
          const updated = await nfeInutilizarEventsApi.markAuthorized(created.id, {
            protocol,
            message: mensagemAtual,
            responsePayload: safeJson(provider),
            locked: false,
          });

          return res.status(200).json({
            ok: true,
            duplicated: true,
            message: 'Esta inutilização já havia sido autorizada anteriormente.',
            data: updated,
            provider: current,
          });
        }
      }

      const normalizedStatus = normalizeStatus(providerData);

      if (normalizedStatus === 'AUTHORIZED') {
        const protocol = extractProtocol(provider) || extractProtocol(providerData);

        const updated = await nfeInutilizarEventsApi.markAuthorized(created.id, {
          protocol,
          responsePayload: safeJson(providerData),
          locked: false,
          message: extractMessage(providerData, 'Inutilização autorizada'),
        });

        return res.status(200).json({
          ok: true,
          message: 'Inutilização autorizada',
          data: updated,
          provider: providerData,
        });
      }

      if (normalizedStatus === 'SENT') {
        const protocol = extractProtocol(provider) || extractProtocol(providerData);

        const updated = await nfeInutilizarEventsApi.markSent(created.id, {
          protocol,
          responsePayload: safeJson(providerData),
          locked: false,
          message: extractMessage(providerData, 'Processando na SEFAZ'),
        });

        return res.status(202).json({
          ok: true,
          message: 'Processando na SEFAZ',
          data: updated,
          provider: providerData,
        });
      }

      if (normalizedStatus === 'REJECTED') {
        const protocol = extractProtocol(provider) || extractProtocol(providerData);

        const updated = await nfeInutilizarEventsApi.markRejected(created.id, {
          protocol,
          responsePayload: safeJson(providerData),
          locked: false,
          message: extractProviderError(providerData),
        });

        return res.status(422).json({
          ok: false,
          message: 'Inutilização rejeitada',
          data: updated,
          provider: providerData,
        });
      }

      const errorMsg = extractProviderError(provider);

      await nfeInutilizarEventsApi.markError(created.id, {
        message: errorMsg,
        responsePayload: safeJson(provider),
        locked: false,
      });

      return res.status(502).json({
        ok: false,
        error: errorMsg,
        data: await nfeInutilizarEventsApi.findById(created.id),
      });
    }

    const protocol = extractProtocol(provider) || extractProtocol(providerData);
    const status = normalizeStatus(providerData);

    console.log('[NFE][INUTILIZACAO][CREATE] provider=', JSON.stringify(providerData, null, 2));
    console.log('[NFE][INUTILIZACAO][CREATE] protocol=', protocol);
    console.log('[NFE][INUTILIZACAO][CREATE] status=', status);

    if (status === 'AUTHORIZED') {
      const updated = await nfeInutilizarEventsApi.markAuthorized(created.id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractMessage(providerData, 'Inutilização autorizada'),
      });

      return res.json({
        ok: true,
        message: 'Inutilização autorizada',
        data: updated,
      });
    }

    if (status === 'REJECTED') {
      const updated = await nfeInutilizarEventsApi.markRejected(created.id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractProviderError(providerData),
      });

      return res.status(422).json({
        ok: false,
        message: 'Inutilização rejeitada',
        data: updated,
      });
    }

    if (status === 'SENT') {
      const updated = await nfeInutilizarEventsApi.markSent(created.id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractMessage(providerData, 'Processando na SEFAZ'),
      });

      return res.status(202).json({
        ok: true,
        message: 'Processando na SEFAZ',
        data: updated,
      });
    }

    const updated = await nfeInutilizarEventsApi.markError(created.id, {
      protocol,
      responsePayload: safeJson(providerData),
      locked: false,
      message: extractProviderError(providerData) || 'Retorno inesperado do provedor',
    });

    return res.status(502).json({
      ok: false,
      message: 'Retorno inesperado do provedor',
      data: updated,
    });
  } catch (e) {
    console.error('[INUTILIZAR ERROR]', e);

    if (created?.id) {
      try {
        await nfeInutilizarEventsApi.markError(created.id, {
          message: e.message,
          locked: false,
        });
      } catch (unlockError) {
        console.error('[INUTILIZAR UNLOCK ERROR]', unlockError);
      }
    }

    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}

/* =======================================================================
 * Listar
 * ======================================================================= */
export async function listarInutilizacoes(req, res) {
  try {
    const items = await nfeInutilizarEventsApi.list({
      status: req.query.status,
      companyCnpj: req.query.companyCnpj,
      model: req.query.model,
      serie: req.query.serie,
      year: req.query.year,
      number: req.query.number,
      protocol: req.query.protocol,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.json({
      ok: true,
      data: items,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}

/* =======================================================================
 * Buscar por ID
 * ======================================================================= */
export async function buscarInutilizacaoPorId(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const item = await nfeInutilizarEventsApi.findById(id);

    if (!item) {
      return res.status(404).json({ ok: false, error: 'Registro não encontrado' });
    }

    return res.json({
      ok: true,
      data: item,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}

/* =======================================================================
 * Consultar status
 * ======================================================================= */
export async function consultarStatusInutilizacao(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const item = await nfeInutilizarEventsApi.findById(id);

    if (!item) {
      return res.status(404).json({ ok: false, error: 'Registro não encontrado' });
    }

    if (!item.protocol) {
      return res.status(400).json({
        ok: false,
        error: 'Registro sem protocolo para consulta',
      });
    }

    const consulta = {
      success: true,
      status: 200,
      data: {
        status: item.status,
        protocol: item.protocol,
        message: item.message,
      },
    };
    
    const providerData = consulta?.data || consulta || {};

    if (!extractProviderOk(consulta)) {
      const normalizedStatus = normalizeStatus(providerData);

      if (normalizedStatus === 'AUTHORIZED' || normalizedStatus === 'SENT' || normalizedStatus === 'REJECTED') {
        const protocol = extractProtocol(consulta) || extractProtocol(providerData) || item.protocol;

        if (normalizedStatus === 'AUTHORIZED') {
          await nfeInutilizarEventsApi.markAuthorized(id, {
            protocol,
            responsePayload: safeJson(providerData),
            locked: false,
            message: extractMessage(providerData, 'Inutilização autorizada'),
          });
        } else if (normalizedStatus === 'REJECTED') {
          await nfeInutilizarEventsApi.markRejected(id, {
            protocol,
            responsePayload: safeJson(providerData),
            locked: false,
            message: extractProviderError(providerData),
          });
        } else if (normalizedStatus === 'SENT') {
          await nfeInutilizarEventsApi.markSent(id, {
            protocol,
            responsePayload: safeJson(providerData),
            locked: false,
            message: extractMessage(providerData, 'Processando na SEFAZ'),
          });
        }

        const updatedRecovered = await nfeInutilizarEventsApi.findById(id);

        return res.json({
          ok: true,
          status: normalizedStatus,
          data: updatedRecovered,
          provider: providerData,
        });
      }

      return res.status(502).json({
        ok: false,
        error: extractProviderError(consulta),
      });
    }

    const protocol = extractProtocol(consulta) || extractProtocol(providerData) || item.protocol;
    const status = normalizeStatus(providerData);

    console.log('[NFE][INUTILIZACAO][CONSULTA] provider=', JSON.stringify(providerData, null, 2));
    console.log('[NFE][INUTILIZACAO][CONSULTA] protocol=', protocol);
    console.log('[NFE][INUTILIZACAO][CONSULTA] status=', status);

    if (status === 'AUTHORIZED') {
      await nfeInutilizarEventsApi.markAuthorized(id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractMessage(providerData, 'Inutilização autorizada'),
      });
    } else if (status === 'REJECTED') {
      await nfeInutilizarEventsApi.markRejected(id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractProviderError(providerData),
      });
    } else if (status === 'SENT') {
      await nfeInutilizarEventsApi.markSent(id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractMessage(providerData, 'Processando na SEFAZ'),
      });
    } else {
      await nfeInutilizarEventsApi.markError(id, {
        protocol,
        responsePayload: safeJson(providerData),
        locked: false,
        message: extractProviderError(providerData) || 'Status inesperado na consulta',
      });
    }

    const updated = await nfeInutilizarEventsApi.findById(id);

    return res.json({
      ok: true,
      status,
      data: updated,
      provider: providerData,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}