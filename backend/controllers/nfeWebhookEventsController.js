// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookEventsController.js — Log Webhook NF-e (PlugNotas)             ║
// ║ CONSART ERP | ESM                                                        ║
// ║                                                                           ║
// ║ Rotas (via nfeWebhookEventsRoutes.js):                                    ║
// ║   POST /api/nfe/webhook/plugnotas     → receiveWebhook                   ║
// ║   GET  /api/nfe/webhooks              → listWebhookEvents                ║
// ║   POST /api/nfe/webhooks/reprocess    → reprocessWebhookNotes            ║
// ║                                                                           ║
// ║ Usa: services/apis/nfeWebhookEventsApi.js                                 ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import pool from '../config/db.js';
import nfeWebhookEventsApi from '../repositories/nfeWebhookEvents/nfeWebhookEvents.index.js';

const PLUG_BASE = process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br';
const PLUG_KEY = process.env.PLUGNOTAS_API_KEY || '';
const PLUG_SECRET = process.env.PLUGNOTAS_WEBHOOK_SECRET || '';

/* ------------------------------------------------------------------------- */
/* Helpers de mapeamento                                                     */
/* ------------------------------------------------------------------------- */

function mapPeriodoFromFront(frontValue = 'today') {
  switch (frontValue) {
    case 'today':
      return 'hoje';
    case 'yesterday':
      return 'ontem';
    case 'last7':
      return '7dias';
    case 'last30':
      return '30dias';
    case 'all':
    default:
      return 'todos';
  }
}

function mapStatusFromFront(frontValue = 'all') {
  switch (frontValue) {
    case 'PENDING':
      return 'pendente';
    case 'PROCESSING':
      return 'processando';
    case 'AUTHORIZED':
      return 'autorizado';
    case 'REJECTED':
      return 'rejeitado';
    case 'CANCELLED':
      return 'cancelado';
    case 'SUBSTITUTED':
      return 'substituido';
    case 'all':
    default:
      return 'todos';
  }
}

/* ============================================================================
   1) Webhook chamado pela PlugNotas
   ============================================================================ */
/**
 * POST /api/nfe/webhook/plugnotas
 * Recebe o JSON da PlugNotas e grava em public."nfeWebhookEvents".
 */
export async function receiveWebhook(req, res) {
  try {
    // (Opcional) Validação de token do webhook
    if (PLUG_SECRET) {
      const token =
        req.headers['x-plugnotas-token'] || req.headers['x-webhook-token'];
      if (token !== PLUG_SECRET) {
        console.warn('[PlugNotas] Webhook com token inválido.');
        return res.status(401).json({ error: 'Invalid webhook token' });
      }
    }

    const p = req.body || {};

    console.log('🛰 [PlugNotas] Webhook recebido:', {
      bodyPreview: JSON.stringify(p).slice(0, 400)
    });

    const emitter_cnpj =
      p?.emissor?.cpfCnpj ||
      p?.empresa?.cpfCnpj ||
      p?.emitter?.cpfCnpj ||
      null;

    const integration_id =
      p?.integracao?.idIntegracao ||
      p?.idIntegracao ||
      p?.referencia ||
      null;

    const plugnotas_uuid =
      p?.id || p?.uuid || p?.documento?.id || p?.nfe?.id || null;

    const chave_acesso =
      p?.chave ||
      p?.chaveAcesso ||
      p?.documento?.chave ||
      p?.nfe?.chave ||
      null;

    const numero_nfe =
      p?.numero || p?.nfe?.numero || p?.documento?.numero || null;

    const serie =
      p?.serie || p?.nfe?.serie || p?.documento?.serie || null;

    const status =
      (p?.status ||
        p?.situacao ||
        p?.documento?.status ||
        p?.nfe?.status ||
        'desconhecido'
      )
        .toString()
        .toLowerCase();

    const cstat =
      p?.cStat || p?.cstat || p?.sefaz?.cstat || p?.nfe?.cstat || null;

    const motivo =
      p?.motivo ||
      p?.motivoSefaz ||
      p?.sefaz?.motivo ||
      p?.erro ||
      null;

    const tipo_evento = (p?.tipoEvento || p?.tipo || 'emissao')
      .toString()
      .toLowerCase();

    const saved = await nfeWebhookEventsApi.insertWebhookEvent(pool, {
      emitter_cnpj: (emitter_cnpj || '').replace(/\D/g, ''),
      integration_id,
      plugnotas_uuid,
      chave_acesso,
      numero_nfe,
      serie,
      status,
      cstat,
      motivo,
      tipo_evento,
      raw_payload: p
    });

    console.log('✅ [PlugNotas] Evento salvo em nfeWebhookEvents:', {
      id: saved.id,
      integration_id,
      chave_acesso,
      status,
      cstat
    });

    return res.status(200).json({ ok: true, id: saved.id });
  } catch (err) {
    console.error('❌ receiveWebhook error:', err);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}

/* ============================================================================
   2) Listagem para a tela de monitor
   ============================================================================ */
/**
 * GET /api/nfe/webhooks
 * Query params (lado front):
 *  - emitterCnpj  (string com dígitos)
 *  - periodo      'today' | 'yesterday' | 'last7' | 'last30' | 'all'
 *  - status       'all' | 'PENDING' | ...
 *  - q            busca livre
 *  - page         número da página
 *  - pageSize     tamanho da página
 */
export async function listWebhookEvents(req, res) {
  try {
    const emitterCnpj = (req.query.emitterCnpj || '').replace(/\D/g, '');
    const periodoFront = req.query.periodo || 'today';
    const statusFront = req.query.status || 'all';

    const data = await nfeWebhookEventsApi.listWebhookEvents(pool, {
      emitterCnpj,
      periodo: mapPeriodoFromFront(periodoFront),
      status: mapStatusFromFront(statusFront),
      q: req.query.q || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20
    });

    return res.json(data);
  } catch (err) {
    console.error('❌ listWebhookEvents error:', err);
    return res.status(500).json({ error: 'Erro ao listar eventos' });
  }
}

/* ============================================================================
   3) Reprocessar / sincronizar notas com erro
   ============================================================================ */
/**
 * POST /api/nfe/webhooks/reprocess
 * body: { emitterCnpj: string, status?: string }
 *
 * 🔹 Função de "Sincronizar":
 *    - busca notas no log com esse CNPJ + status (padrão: REJECTED)
 *    - consulta o status atual na PlugNotas (GET /nfe/{uuid})
 *    - grava um NOVO registro em nfeWebhookEvents com tipo_evento = 'consulta'
 *
 * OBS: o endpoint exato da PlugNotas pode mudar. Confirme na documentação
 *      oficial e ajuste a URL, se necessário.
 */
export async function reprocessWebhookNotes(req, res) {
  try {
    if (!PLUG_KEY) {
      return res.status(500).json({ error: 'PLUGNOTAS_API_KEY não configurada' });
    }

    const { emitterCnpj, status: statusFront = 'REJECTED' } = req.body || {};
    const clean = (emitterCnpj || '').replace(/\D/g, '');

    if (!clean) {
      return res
        .status(400)
        .json({ error: 'emitterCnpj é obrigatório para reprocesso' });
    }

    const statusBackend = mapStatusFromFront(statusFront) || 'rejeitado';

    const result = await nfeWebhookEventsApi.listWebhookEvents(pool, {
      emitterCnpj: clean,
      periodo: '30dias',
      status: statusBackend,
      q: '',
      page: 1,
      pageSize: 50
    });

    const notes = result.rows || [];
    if (!notes.length) {
      return res.json({
        ok: true,
        reprocessed: 0,
        failed: 0,
        message: 'Nenhuma nota encontrada para o reprocesso.'
      });
    }

    let reprocessed = 0;
    let failed = 0;

    for (const note of notes) {
      if (!note.plugnotas_uuid) {
        console.warn(
          '[PlugNotas] Nota sem plugnotas_uuid, ignorando:',
          note.id
        );
        continue;
      }

      try {
        // ⚠ Ajuste esta URL de acordo com o endpoint real de consulta da PlugNotas.
        // Exemplo típico: GET /nfe/{uuid}
        const url = `${PLUG_BASE}/nfe/${encodeURIComponent(
          note.plugnotas_uuid
        )}`;

        const resp = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${PLUG_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const data = resp.data || {};

        const newStatus = (data.status || note.status || '').toString().toLowerCase();

        await nfeWebhookEventsApi.insertWebhookEvent(pool, {
          emitter_cnpj: clean,
          integration_id: note.integration_id,
          plugnotas_uuid: note.plugnotas_uuid,
          chave_acesso: data.chave || data.chaveAcesso || note.chave_acesso,
          numero_nfe: data.numero || note.numero_nfe,
          serie: data.serie || note.serie,
          status: newStatus,
          cstat: data.cStat || data.cstat || note.cstat,
          motivo: data.motivo || note.motivo,
          tipo_evento: 'consulta',
          raw_payload: data
        });

        reprocessed++;
      } catch (err) {
        failed++;
        console.error(
          '[PlugNotas] Erro ao consultar nota',
          note.plugnotas_uuid,
          err.response?.data || err.message
        );
      }
    }

    return res.json({ ok: true, reprocessed, failed });
  } catch (err) {
    console.error('❌ reprocessWebhookNotes error:', err);
    return res.status(500).json({ error: 'Erro ao reprocessar notas' });
  }
}

export async function getWebhookEvent(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT *
         FROM public."nfeWebhookEvents"
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Evento não encontrado' });
    }

    return res.json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('❌ getWebhookEvent error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao buscar evento' });
  }
}

export async function getWebhookXml(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT raw_payload
         FROM public."nfeWebhookEvents"
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Evento não encontrado' });
    }

    const raw = rows[0].raw_payload || {};
    const xml =
      raw.xml ||
      raw.xmlAutorizado ||
      raw.documento?.xml ||
      raw.nfe?.xml ||
      null;

    if (!xml) {
      return res.status(404).json({
        ok: false,
        error: 'XML não encontrado no payload do webhook'
      });
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (err) {
    console.error('❌ getWebhookXml error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao buscar XML' });
  }
}

export async function getWebhookDanfe(req, res) {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT raw_payload
         FROM public."nfeWebhookEvents"
        WHERE id = $1
        LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Evento não encontrado' });
    }

    const raw = rows[0].raw_payload || {};
    const danfe =
      raw.danfe ||
      raw.danfeUrl ||
      raw.pdf ||
      raw.pdfUrl ||
      raw.documento?.danfe ||
      raw.documento?.danfeUrl ||
      raw.nfe?.danfe ||
      raw.nfe?.danfeUrl ||
      null;

    if (!danfe) {
      return res.status(404).json({
        ok: false,
        error: 'DANFE não encontrado no payload do webhook'
      });
    }

    return res.json({ ok: true, danfe });
  } catch (err) {
    console.error('❌ getWebhookDanfe error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao buscar DANFE' });
  }
}

export default {
  receiveWebhook,
  listWebhookEvents,
  reprocessWebhookNotes,
  getWebhookEvent,
  getWebhookXml,
  getWebhookDanfe
};