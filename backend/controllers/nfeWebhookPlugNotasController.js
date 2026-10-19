// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookPlugNotasController.js — NF-e Webhook (PlugNotas)         ║
// ║ CONSART ERP | ESM                                                   ║
// ║                                                                      ║
// ║ - POST /api/nfe/webhook/plugnotas   ← recebe evento da PlugNotas    ║
// ║ - GET  /api/nfe/webhooks            ← lista para o monitor          ║
// ║ - POST /api/nfe/webhooks/reprocess  ← reprocessar/sincronizar notas ║
// ║                                                                      ║
// ║ Usa a tabela: public."nfeWebhookEvents" via nfeWebhookEventsApi     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import pool from '../config/db.js';
import nfeWebhookEventsApi from '../repositories/nfeWebhookEvents/nfeWebhookEvents.index.js';

const PLUGNOTAS_BASE_URL =
  process.env.PLUGNOTAS_BASE_URL || 'https://api.plugnotas.com.br';
const PLUGNOTAS_API_KEY = process.env.PLUGNOTAS_API_KEY || '';
const PLUGNOTAS_WEBHOOK_SECRET = process.env.PLUGNOTAS_WEBHOOK_SECRET || '';

/* --------------------------------------------------------------------- */
/* 1) Webhook chamado pela PlugNotas/TecnoSpeed                          */
/* --------------------------------------------------------------------- */
/**
 * Recebe o JSON da PlugNotas, normaliza campos principais
 * e grava em public."nfeWebhookEvents" via nfeWebhookEventsApi.
 */
export async function receiveWebhook(req, res) {
  try {
    // (Opcional) valida token de segurança do webhook
    if (PLUGNOTAS_WEBHOOK_SECRET) {
      const tokenHeader =
        req.headers['x-plugnotas-token'] || req.headers['x-webhook-token'];
      if (tokenHeader !== PLUGNOTAS_WEBHOOK_SECRET) {
        console.warn('[PlugNotas] Webhook com token inválido');
        return res.status(401).json({ error: 'Invalid webhook token' });
      }
    }

    const payload = req.body || {};

    console.log('🛰 [PlugNotas] Webhook recebido:', {
      headers: req.headers,
      bodySample: JSON.stringify(payload).slice(0, 500)
    });

    // 🔹 Normalização: adapte aqui aos campos reais da PlugNotas
    const emitter_cnpj =
      payload?.emissor?.cpfCnpj ||
      payload?.empresa?.cpfCnpj ||
      payload?.emitter?.cpfCnpj ||
      null;

    const integration_id =
      payload?.integracao?.idIntegracao ||
      payload?.idIntegracao ||
      payload?.referencia ||
      null;

    const plugnotas_uuid =
      payload?.id ||
      payload?.uuid ||
      payload?.documento?.id ||
      payload?.nfe?.id ||
      null;

    const chave_acesso =
      payload?.chave ||
      payload?.chaveAcesso ||
      payload?.documento?.chave ||
      payload?.nfe?.chave ||
      null;

    const numero_nfe =
      payload?.numero ||
      payload?.nfe?.numero ||
      payload?.documento?.numero ||
      null;

    const serie =
      payload?.serie ||
      payload?.nfe?.serie ||
      payload?.documento?.serie ||
      null;

    const status =
      (payload?.status ||
        payload?.situacao ||
        payload?.documento?.status ||
        payload?.nfe?.status ||
        'desconhecido'
      ).toString().toLowerCase();

    const cstat =
      payload?.cStat ||
      payload?.cstat ||
      payload?.sefaz?.cstat ||
      payload?.nfe?.cstat ||
      null;

    const motivo =
      payload?.motivo ||
      payload?.motivoSefaz ||
      payload?.sefaz?.motivo ||
      payload?.erro ||
      null;

    const tipo_evento = (payload?.tipoEvento || payload?.tipo || 'emissao')
      .toString()
      .toLowerCase();

    if (!emitter_cnpj) {
      console.warn('[PlugNotas] Webhook sem CNPJ do emissor');
    }

    // 🔹 Grava na tabela via API
    const inserted = await nfeWebhookEventsApi.insertWebhookEvent(pool, {
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
      raw_payload: payload
    });

    console.log('✅ [PlugNotas] Evento salvo em nfeWebhookEvents:', {
      id: inserted.id,
      integration_id,
      chave_acesso,
      status,
      cstat
    });

    // 🔹 Aqui você pode atualizar sua tabela de pedidos/notas, se quiser:
    // if (integration_id && chave_acesso) {
    //   await pool.query(
    //     'UPDATE public."orders" SET nfe_status = $1, nfe_chave = $2 WHERE id_integracao = $3',
    //     [status, chave_acesso, integration_id]
    //   );
    // }

    // PlugNotas só precisa de 2xx pra considerar OK
    return res.status(200).json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error('[PlugNotas] Erro em receiveWebhook:', err);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}

/* --------------------------------------------------------------------- */
/* 2) Lista para o monitor /webhookPlugNotas.html                        */
/* --------------------------------------------------------------------- */
/**
 * GET /api/nfe/webhooks
 * Compatível com webhookPlugNotas.js
 */
export async function listWebhooks(req, res) {
  try {
    const {
      emitterCnpj,
      periodo = 'hoje', // 'hoje' | 'ontem' | '7dias' | '30dias' | 'todos'
      status = 'todos',
      q = '',
      page = 1,
      pageSize = 20
    } = req.query;

    const data = await nfeWebhookEventsApi.listWebhookEvents(pool, {
      emitterCnpj,
      periodo,
      status,
      q,
      page,
      pageSize
    });

    return res.json(data);
  } catch (err) {
    console.error('[PlugNotas] listWebhooks error:', err);
    return res.status(500).json({ error: 'Erro ao listar webhooks' });
  }
}

/* --------------------------------------------------------------------- */
/* 3) Reprocessar / sincronizar notas com erro                           */
/* --------------------------------------------------------------------- */
/**
 * POST /api/nfe/webhooks/reprocess
 * body: { emitterCnpj: string, status: 'rejeitado' | 'pendente' | ... }
 *
 * 🔹 Aqui o fluxo é:
 *   - busca no log (tabela nfeWebhookEvents) as notas com esse status
 *   - chama o endpoint de reprocesso/sync na PlugNotas para cada uma
 *   - retorna quantas foram processadas com sucesso/falha
 *
 * Você depois pode adaptar para chamar a rota EXATA da PlugNotas que você
 * tiver (consultar docs oficiais).
 */
export async function reprocessFromFilters(req, res) {
  try {
    if (!PLUGNOTAS_API_KEY) {
      return res
        .status(500)
        .json({ error: 'PLUGNOTAS_API_KEY não configurada no .env' });
    }

    const { emitterCnpj, status = 'rejeitado' } = req.body || {};
    const cleanCnpj = (emitterCnpj || '').replace(/\D/g, '');

    if (!cleanCnpj) {
      return res
        .status(400)
        .json({ error: 'emitterCnpj é obrigatório para reprocesso' });
    }

    // 🔹 Busca um lote de notas com esse status
    const result = await nfeWebhookEventsApi.listWebhookEvents(pool, {
      emitterCnpj: cleanCnpj,
      periodo: '30dias',
      status,
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
        message: 'Nenhuma nota encontrada com os filtros informados.'
      });
    }

    let success = 0;
    let fail = 0;

    // 🔹 Para cada nota, chama um endpoint de reprocesso da PlugNotas
    for (const note of notes) {
      if (!note.plugnotas_uuid) {
        console.warn(
          '[PlugNotas] Nota sem plugnotas_uuid, ignorando reprocesso:',
          note.id
        );
        continue;
      }

      try {
        // ATENÇÃO: ajuste este path para o correto na documentação da PlugNotas
        // Exemplo fictício: POST /nfe/{uuid}/reprocessar
        const url = `${PLUGNOTAS_BASE_URL}/nfe/${encodeURIComponent(
          note.plugnotas_uuid
        )}/reprocessar`;

        await axios.post(
          url,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${PLUGNOTAS_API_KEY}`
            },
            timeout: 15000
          }
        );

        console.log(
          '[PlugNotas] Reprocesso solicitado com sucesso para',
          note.plugnotas_uuid
        );
        success++;
      } catch (err) {
        fail++;
        console.error(
          '[PlugNotas] Erro ao reprocessar nota',
          note.plugnotas_uuid,
          err.response?.data || err.message
        );
      }
    }

    return res.json({
      ok: true,
      reprocessed: success,
      failed: fail
    });
  } catch (err) {
    console.error('[PlugNotas] reprocessFromFilters error:', err);
    return res.status(500).json({ error: 'Erro ao reprocessar notas' });
  }
}
