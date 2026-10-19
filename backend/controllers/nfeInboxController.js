// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInboxController.js — Controller Caixa de Entrada NF-e            ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Rotas:                                                              ║
// ║   GET  /api/nfe-inbox                → listNfeInbox                  ║
// ║   GET  /api/nfe-inbox/xml-lote       → downloadNfeXmlLote (ZIP)      ║
// ║   GET  /api/nfe-inbox/:id            → getNfeInboxById               ║
// ║   GET  /api/nfe-inbox/:id/xml        → downloadNfeXml                ║
// ║   GET  /api/nfe-inbox/:id/pdf        → downloadNfePdf                ║
// ║   POST /api/nfe-inbox/:id/manifest   → manifestNfe                   ║
// ║   POST /api/nfe-inbox/import-xml     → importNfeXml (upload)         ║
// ║   POST /api/nfe-inbox/sync-dfe       → syncNfeInboxFromDfe           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import archiver from 'archiver';
import { parseStringPromise } from 'xml2js';

import * as nfeInboxApi from '../repositories/nfeInbox/nfeInbox.index.js';
import tecnoSpeedDfeApi from '../repositories/tecnoSpeedDFe/tecnoSpeedDFe.index.js';
import { generateDanfeFromXml } from '../services/danfeConsartServiceToNfeInbox.js';

let autoSyncTimer = null;
let syncInProgress = false;

// ======================================================================
// Estado da última sincronização
// Fica em memória: reflete o processo atual e zera a cada restart.
// ======================================================================
const lastSync = {
  status: 'never',   // never | running | ok | error
  trigger: null,     // boot | auto | manual
  startedAt: null,
  finishedAt: null,
  totalInseridas: 0,
  message: null,
};

function snapshotSync() {
  return { ...lastSync };
}

/**
 * Executa a sincronização registrando início, fim e resultado.
 * Usada tanto pelo timer automático quanto pela rota manual.
 */
async function runSynchronization(cnpj, trigger) {
  lastSync.status = 'running';
  lastSync.trigger = trigger;
  lastSync.startedAt = new Date().toISOString();
  lastSync.message = null;

  try {
    const result = await synchronizeDfe(cnpj);

    lastSync.status = 'ok';
    lastSync.finishedAt = new Date().toISOString();
    lastSync.totalInseridas = result.totalInseridas;

    return result;
  } catch (err) {
    lastSync.status = 'error';
    lastSync.finishedAt = new Date().toISOString();
    lastSync.message = err?.message || String(err);

    throw err;
  }
}

// ======================================================================
// Bootstrap
// ======================================================================
export async function initNfeInboxController() {
  try {
    await nfeInboxApi.ensureTable();

    const autoSyncEnabled =
      String(process.env.NFE_INBOX_AUTO_SYNC).toLowerCase() === 'true';

    if (!autoSyncEnabled) {
      console.log('[nfeInbox] Sincronização automática desativada.');
      return;
    }

    if (autoSyncTimer) {
      console.log('[nfeInbox] Sincronização automática já está ativa.');
      return;
    }

    const cnpj = getConfiguredCnpj();

    const configuredMinutes = Number(
      process.env.NFE_INBOX_SYNC_INTERVAL_MINUTES
    );

    const intervalMinutes =
      Number.isFinite(configuredMinutes) && configuredMinutes >= 1
        ? configuredMinutes
        : 15;

    const runSync = async () => {
      if (syncInProgress) {
        console.log('[nfeInbox] Sincronização anterior ainda em andamento.');
        return;
      }

      syncInProgress = true;

      try {
        const result = await runSynchronization(cnpj, 'auto');

        console.log(
          `[nfeInbox] DF-e sincronizado. Notas processadas: ${result.totalInseridas}.`
        );
      } catch (err) {
        console.error('[nfeInbox] Erro na sincronização automática:', err);
      } finally {
        syncInProgress = false;
      }
    };

    // Performs one synchronization when the server starts.
    await runSync();

    // Repeats synchronization at the configured interval.
    autoSyncTimer = setInterval(
      runSync,
      intervalMinutes * 60 * 1000
    );

    // Allows Node to terminate normally when no other work remains.
    autoSyncTimer.unref?.();

    console.log(
      `[nfeInbox] Sincronização automática ativada a cada ${intervalMinutes} minutos.`
    );
  } catch (err) {
    console.error('initNfeInboxController() failed:', err);
    throw err;
  }
}

// ======================================================================
// Helpers
// ======================================================================
function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function getConfiguredCnpj() {
  const cnpj = onlyDigits(process.env.NFE_INBOX_CNPJ_EMPRESA);

  if (cnpj.length !== 14) {
    throw new Error(
      'NFE_INBOX_CNPJ_EMPRESA deve conter exatamente 14 dígitos no .env.'
    );
  }

  return cnpj;
}

function toTimestampOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeDateYmd(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Ordenação vinda da query string.
 *
 * Aqui só normaliza o formato — a validação real é feita no DAL, que
 * usa `sort` como chave de um whitelist. Valores desconhecidos caem no
 * padrão (data de autorização, decrescente) em vez de gerar erro.
 */
function readSortParams(query = {}) {
  const sort = String(query.sort || '').trim();
  const order = String(query.order || '').trim().toLowerCase();

  return {
    sort: sort || null,
    order: order === 'asc' || order === 'desc' ? order : null,
  };
}

/**
 * ✅ NOVO: Formata valor no padrão BR (R$ 1.234,56)
 */
function formatMoneyBR(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0,00';
  // sem Intl para evitar diferenças de ambiente
  const fixed = n.toFixed(2); // "1234.56"
  const [i, d] = fixed.split('.');
  const i2 = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${i2},${d}`;
}

/**
 * ✅ NOVO: limpa caracteres inválidos para nome de arquivo (Windows)
 */
function safeFileName(name) {
  return String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ✅ NOVO: monta o nome do XML como:
 * <CHAVE> (XML - R$<VALOR> - <DATA_EMISSAO>).xml
 */
function buildXmlFileName(nf) {
  const chave = String(nf?.chave_nfe || '').trim();
  const valor = `R$${formatMoneyBR(nf?.valor_total)}`;

  // prioridade: data_emissao; fallback: data_autorizacao; fallback: SEM-DATA
  const dt =
    safeDateYmd(nf?.data_emissao) ||
    safeDateYmd(nf?.data_autorizacao) ||
    'SEM-DATA';

  const base = `${chave} (XML - ${valor} - ${dt}).xml`;
  return safeFileName(base) || `${chave}.xml`;
}

// Normaliza campos principais do XML (cobertura prática p/ NF-e)
function extractFromNfeXml(parsed) {
  const nfe = parsed?.nfeProc?.NFe?.[0] || parsed?.NFe || parsed?.NFe?.[0] || null;
  const infNFe = nfe?.infNFe?.[0] || nfe?.infNFe || null;

  const ide = infNFe?.ide?.[0] || infNFe?.ide || {};
  const emit = infNFe?.emit?.[0] || infNFe?.emit || {};
  const dest = infNFe?.dest?.[0] || infNFe?.dest || {};
  const total = infNFe?.total?.[0] || infNFe?.total || {};
  const icmsTot = total?.ICMSTot?.[0] || total?.ICMSTot || {};

  const chaveFromAttr =
    infNFe?.$?.Id ? String(infNFe.$.Id).replace(/^NFe/i, '') : null;

  const dhEmi = ide?.dhEmi || ide?.dEmi || null;
  const dhSaiEnt = ide?.dhSaiEnt || null;

  return {
    chave_nfe: onlyDigits(chaveFromAttr),
    modelo: ide?.mod || null,
    serie: ide?.serie || null,
    numero: ide?.nNF != null ? String(ide.nNF) : null,
    data_emissao: dhEmi ? new Date(dhEmi) : null,
    data_autorizacao: dhSaiEnt ? new Date(dhSaiEnt) : null,
    emitente_cnpj: onlyDigits(emit?.CNPJ || emit?.CPF || ''),
    emitente_razao: emit?.xNome || null,
    destinatario_cnpj: onlyDigits(dest?.CNPJ || dest?.CPF || ''),
    destinatario_razao: dest?.xNome || null,
    valor_total: icmsTot?.vNF != null ? Number(String(icmsTot.vNF).replace(',', '.')) : null,
  };
}

// ======================================================================
// Serviço compartilhado de sincronização DF-e
// ======================================================================
async function synchronizeDfe(cnpjEmpresa) {
  const cnpj = onlyDigits(cnpjEmpresa);

  if (cnpj.length !== 14) {
    throw new Error('CNPJ da empresa inválido para sincronização DF-e.');
  }

  const page = await tecnoSpeedDfeApi.listDfe({
    cnpjDestinatario: cnpj,
  });

  let total = 0;

  for (const nota of page?.notas || []) {
    await nfeInboxApi.upsertFromParsedNfe({
      cnpj_empresa: cnpj,
      chave_nfe: nota.chave,
      nsu: nota.raw?.nsu || null,
      situacao: nota.status || 'AUTORIZADA',
      tipo_operacao: nota.saida ? 'SAIDA' : 'ENTRADA',
      modelo: '55',
      serie: nota.serie,
      numero: String(nota.numero || ''),
      data_emissao: toTimestampOrNull(nota.dataEmissao),
      data_autorizacao: toTimestampOrNull(nota.dataAutorizacao),
      emitente_cnpj: nota.emitente?.cpfCnpj,
      emitente_razao: nota.emitente?.razaoSocial,
      destinatario_cnpj: nota.destinatario?.cpfCnpj,
      destinatario_razao: nota.destinatario?.razaoSocial,
      valor_total: nota.totais?.valorNfe,
      manifestacao: nota.manifestacao || null,
      origem: 'DFE_TECNOSPEED',
    });

    total += 1;
  }

  return {
    totalInseridas: total,
    nextPageHash: page?.nextPageHash || null,
  };
}

// ======================================================================
// GET /api/nfe-inbox
// ======================================================================
export async function listNfeInbox(req, res) {
  try {
    const requestedLimit = Number(req.query.limit);
    const requestedOffset = Number(req.query.offset);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.trunc(requestedLimit), 100)
      : 20;
    const offset = Number.isFinite(requestedOffset) && requestedOffset >= 0
      ? Math.trunc(requestedOffset)
      : 0;

    const filters = {
      cnpjEmpresa: req.query.cnpjEmpresa || null,
      situacao: req.query.situacao || null,
      manifestacao: req.query.manifestacao || null,
      dataIni: req.query.dataIni || null,
      dataFim: req.query.dataFim || null,
      q: req.query.q || null,
    };

    // Ordenação enviada pelos cabeçalhos ordenáveis da tabela.
    const { sort, order } = readSortParams(req.query);

    const [rows, total] = await Promise.all([
      nfeInboxApi.list({ ...filters, sort, order, limit, offset }),
      nfeInboxApi.count(filters),
    ]);

    return res.json({
      success: true,
      data: rows,
      total,
      limit,
      offset,
      sort: sort || nfeInboxApi.DEFAULT_SORT_COLUMN,
      order: order || nfeInboxApi.DEFAULT_SORT_DIRECTION,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('listNfeInbox()', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao listar a caixa de entrada de NF-e.',
    });
  }
}

// ======================================================================
// GET /api/nfe-inbox/:id
// ======================================================================
export async function getNfeInboxById(req, res) {
  try {
    const row = await nfeInboxApi.getById(req.params.id);
    if (!row) return res.status(404).json({ success: false });
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('getNfeInboxById()', err);
    res.status(500).json({ success: false });
  }
}

// ======================================================================
// GET /api/nfe-inbox/:id/xml
// ======================================================================
export async function downloadNfeXml(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'INVALID_ID' });

    const row = await nfeInboxApi.getById(id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'NF_NOT_FOUND' });
    }

    if (row.has_xml) {
      return res.type('application/xml').send(row.xml_completo);
    }

    const xml = await tecnoSpeedDfeApi.downloadXmlByKey(row.chave_nfe, row.cnpj_empresa);

    if (!xml) {
      return res.status(404).json({
        success: false,
        error: 'XML_NOT_AVAILABLE',
        message: 'XML ainda não liberado (manifestação pode ser exigida).',
      });
    }

    const saved = await nfeInboxApi.saveXmlCompletoById(id, xml);
    return res.type('application/xml').send(saved?.xml_completo || xml);
  } catch (err) {
    const status = err?.response?.status;
    if ([429, 502, 503, 504].includes(status)) {
      return res.status(502).json({ success: false, error: 'PLUGNOTAS_UNAVAILABLE' });
    }
    console.error('downloadNfeXml()', err);
    res.status(500).json({ success: false });
  }
}

// ======================================================================
// GET /api/nfe-inbox/:id/pdf
// ======================================================================
export async function downloadNfePdf(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'INVALID_ID' });

    const row = await nfeInboxApi.getById(id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'NF_NOT_FOUND' });
    }

    let xml = row.xml_completo;

    if (!xml || String(xml).length <= 200) {
      xml = await tecnoSpeedDfeApi.downloadXmlByKey(row.chave_nfe, row.cnpj_empresa);

      if (!xml) {
        return res.status(404).json({
          success: false,
          error: 'XML_NOT_AVAILABLE',
          message: 'XML ainda não liberado (manifestação pode ser exigida).',
        });
      }

      await nfeInboxApi.saveXmlCompletoById(id, xml);
    }

    const { buffer, filename } = await generateDanfeFromXml({
      xmlContent: xml,
      chave: row.chave_nfe,
      numero: row.numero || '000000000',
      serie: row.serie || '001',
      prot: { status: row.situacao || '' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename || `DANFE-${row.chave_nfe}.pdf`)}"`
    );

    return res.status(200).send(buffer);
  } catch (err) {
    const status = err?.response?.status;
    if ([429, 502, 503, 504].includes(status)) {
      return res.status(502).json({ success: false, error: 'PLUGNOTAS_UNAVAILABLE' });
    }
    console.error('downloadNfePdf()', err);
    return res.status(500).json({ success: false });
  }
}

// ======================================================================
// POST /api/nfe-inbox/:id/manifest
// ======================================================================
export async function manifestNfe(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'INVALID_ID' });

    const { operacao, justificativa } = req.body || {};
    if (!operacao) return res.status(400).json({ success: false, error: 'OPERACAO_REQUIRED' });

    const row = await nfeInboxApi.getById(id);
    if (!row) return res.status(404).json({ success: false });

    await tecnoSpeedDfeApi.manifestarNfe({
      chave: row.chave_nfe,
      cpfCnpj: row.cnpj_empresa,
      operacao,
      justificativa,
    });

    await nfeInboxApi.upsertFromParsedNfe({
      chave_nfe: row.chave_nfe,
      cnpj_empresa: row.cnpj_empresa,
      manifestacao: { operacao },
      manifestado_em: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error('manifestNfe()', err);
    // 4xx = recusa da SEFAZ/validação: devolve a mensagem para a tela
    const status = Number(err?.status) >= 400 && Number(err?.status) < 500 ? Number(err.status) : 500;
    res.status(status).json({ success: false, error: err?.message || 'MANIFEST_FAILED' });
  }
}

// ======================================================================
// POST /api/nfe-inbox/import-xml  (upload manual)
// FormData: files[] (.xml)
// ======================================================================
export async function importNfeXml(req, res) {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, error: 'NO_FILES' });
    }

    let imported = 0;
    const errors = [];

    for (const f of files) {
      try {
        const xmlText = Buffer.isBuffer(f.buffer) ? f.buffer.toString('utf8') : String(f.buffer || '');
        if (!xmlText || xmlText.length < 50) throw new Error('XML vazio/curto');

        const parsed = await parseStringPromise(xmlText, { explicitArray: true, trim: true });
        const data = extractFromNfeXml(parsed);

        if (!data.chave_nfe || String(data.chave_nfe).length !== 44) {
          throw new Error('Chave inválida no XML');
        }

        const cnpjEmpresa = onlyDigits(req.body?.cnpjEmpresa) || data.destinatario_cnpj || data.emitente_cnpj;
        if (!cnpjEmpresa || cnpjEmpresa.length !== 14) {
          throw new Error('CNPJ empresa não informado e não encontrado no XML');
        }

        await nfeInboxApi.upsertFromParsedNfe({
          cnpj_empresa: cnpjEmpresa,
          chave_nfe: data.chave_nfe,
          situacao: 'AUTORIZADA',
          tipo_operacao: 'ENTRADA',
          modelo: data.modelo || '55',
          serie: data.serie || null,
          numero: data.numero || null,
          data_emissao: data.data_emissao || null,
          data_autorizacao: data.data_autorizacao || null,
          emitente_cnpj: data.emitente_cnpj || null,
          emitente_razao: data.emitente_razao || null,
          destinatario_cnpj: data.destinatario_cnpj || null,
          destinatario_razao: data.destinatario_razao || null,
          valor_total: data.valor_total != null ? data.valor_total : null,
          xml_resumido: parsed,
          xml_completo: xmlText,
          origem: 'UPLOAD_XML',
        });

        imported++;
      } catch (e) {
        errors.push({ file: f?.originalname || 'file', message: e?.message || String(e) });
      }
    }

    return res.json({
      success: true,
      imported,
      failed: errors.length,
      errors,
    });
  } catch (err) {
    console.error('importNfeXml()', err);
    return res.status(500).json({ success: false, error: 'IMPORT_FAILED' });
  }
}

// ======================================================================
// POST /api/nfe-inbox/sync-dfe
// Body: vazio — o CNPJ é lido de NFE_INBOX_CNPJ_EMPRESA
// ======================================================================
export async function syncNfeInboxFromDfe(req, res) {
  try {
    // O CNPJ fica exclusivamente no backend e nunca precisa vir do navegador.
    const result = await runSynchronization(getConfiguredCnpj(), 'manual');

    return res.json({
      success: true,
      ...result,
      lastSync: snapshotSync(),
    });
  } catch (err) {
    console.error('syncNfeInboxFromDfe()', err);

    return res.status(500).json({
      success: false,
      message: err?.message || 'Erro ao sincronizar DF-e.',
      lastSync: snapshotSync(),
    });
  }
}

// ======================================================================
// GET /api/nfe-inbox/sync-status
// Última execução da sincronização DF-e (bootstrap + timer + manual)
// ======================================================================
export async function getNfeInboxSyncStatus(req, res) {
  try {
    const enabled =
      String(process.env.NFE_INBOX_AUTO_SYNC).toLowerCase() === 'true';

    const configuredMinutes = Number(
      process.env.NFE_INBOX_SYNC_INTERVAL_MINUTES
    );

    const intervalMinutes =
      Number.isFinite(configuredMinutes) && configuredMinutes >= 1
        ? configuredMinutes
        : 15;

    return res.json({
      success: true,
      data: {
        ...snapshotSync(),
        autoSyncEnabled: enabled,
        autoSyncActive: Boolean(autoSyncTimer),
        intervalMinutes,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('getNfeInboxSyncStatus()', err);
    return res.status(500).json({
      success: false,
      message: 'Erro ao consultar o status da sincronização.',
    });
  }
}

// ======================================================================
// 📦 GET /api/nfe-inbox/xml-lote
// ======================================================================
export async function downloadNfeXmlLote(req, res) {
  try {
    const cnpjEmpresa = req.query.cnpjEmpresa ? onlyDigits(req.query.cnpjEmpresa) : null;
    const situacao = req.query.situacao || null;
    const manifestacao = req.query.manifestacao || null;
    const dataIni = req.query.dataIni || null;
    const dataFim = req.query.dataFim || null;
    const q = req.query.q || null;

    // O ZIP segue a mesma ordem exibida na tela.
    const { sort, order } = readSortParams(req.query);

    const limit = Number(req.query.limit);
    const offset = Number(req.query.offset);

    const rows = await nfeInboxApi.list({
      cnpjEmpresa,
      situacao,
      manifestacao,
      dataIni,
      dataFim,
      q,
      sort,
      order,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
    });

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: 'NO_ROWS',
      });
    }

    const dtIni = safeDateYmd(dataIni) || 'ini';
    const dtFim = safeDateYmd(dataFim) || 'fim';
    const pageNum =
      Math.floor(
        (Number.isFinite(offset) ? offset : 0) /
        (Number.isFinite(limit) && limit > 0 ? limit : 100)
      ) + 1;

    const zipName = `NFe-XML-LOTE_${dtIni}_a_${dtFim}_p${pageNum}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('[xml-lote][archiver error]', err);
      try { res.status(500).end(); } catch { }
    });

    archive.pipe(res);

    const report = {
      generatedAt: new Date().toISOString(),
      totalRows: rows.length,
      sort: sort || nfeInboxApi.DEFAULT_SORT_COLUMN,
      order: order || nfeInboxApi.DEFAULT_SORT_DIRECTION,
      ok: [],
      pending: [],
      errors: [],
    };

    for (const nf of rows) {
      const accessKey = nf.chave_nfe;
      const id = nf.id;

      if (!accessKey || String(accessKey).length !== 44) {
        report.errors.push({ id, chave: accessKey });
        continue;
      }

      let xml = nf.xml_completo;

      if (!xml || String(xml).length <= 200) {
        try {
          xml = await tecnoSpeedDfeApi.downloadXmlByKey(accessKey, nf.cnpj_empresa);
          if (xml) {
            await nfeInboxApi.saveXmlCompletoById(id, xml);
          }
        } catch {
          xml = null;
        }
      }

      if (!xml) {
        archive.append(
          `XML não disponível para ${accessKey}`,
          { name: `PENDENTE_XML/${accessKey}.txt` }
        );
        report.pending.push({ id, chave: accessKey });
        continue;
      }

      // ✅ AGORA USA O NOME DO EMITENTE
      const fileName = buildXmlFileName(nf);

      archive.append(String(xml), { name: fileName });
      report.ok.push({ id, chave: accessKey, file: fileName });
    }

    archive.append(JSON.stringify(report, null, 2), {
      name: '_relatorio.json',
    });

    await archive.finalize();
  } catch (err) {
    console.error('downloadNfeXmlLote()', err);
    res.status(500).json({ success: false, error: 'ZIP_FAILED' });
  }
}