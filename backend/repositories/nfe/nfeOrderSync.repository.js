// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeOrderSync.repository.js — Sincroniza NF-e com ORDERS              ║
// ║ ✔ Mapeia resumo → campos do pedido                                   ║
// ║ ✔ reconcileOrderNfe + baixa de estoque                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as stockFromOrdersService from '../../services/stockFromOrdersService.js';
import {
  toUpperSafe,
} from './nfe.utils.js';
import {
  consultarNFe,
} from '../tecnoSpeedNfe/tecnoSpeedNfeQuery.repository.js';

/* =========================================================================
 * 🔁 Atualização de ORDERS com dados da NF-e
 * ========================================================================= */
export function mapResumoToOrderNfeFields(resumo = {}, ambienteFallback = null) {
  const chave =
    resumo.chaveAcesso ??
    resumo.chave_acesso ??
    resumo.chave ??
    resumo.chaveNfe ??
    resumo.chaveNFe ??
    null;

  const numeroRaw =
    resumo.nfe_number ??
    resumo.nfeNumero ??
    resumo.numeroNfe ??
    resumo.numero ??
    null;

  const protocolo =
    resumo.protocolo ??
    resumo.protocoloAutorizacao ??
    resumo.protocoloAutorizacaoUso ??
    resumo.protocoloAutorizacaoNFe ??
    null;

  const statusRaw =
    resumo.situacao ??
    resumo.status ??
    resumo.situacaoNfe ??
    resumo.descricaoSituacao ??
    null;

  const tpAmbRaw = resumo.tpAmb ?? resumo.tipoAmbiente ?? null;

  let ambiente = ambienteFallback || null;
  if (tpAmbRaw != null) {
    const v = String(tpAmbRaw);
    ambiente = v === '1' ? 'PRODUCAO' : 'HOMOLOGACAO';
  }

  let numero = null;
  if (numeroRaw != null && numeroRaw !== '') {
    const n = Number(numeroRaw);
    if (Number.isFinite(n)) numero = n;
  }

  const status = statusRaw ? String(statusRaw).toUpperCase() : null;

  return { chave, numero, protocolo, status, ambiente };
}

export async function updateOrderNfeInfo(orderId, resumo = {}, extra = {}) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    console.warn('[NFE] updateOrderNfeInfo chamado com orderId inválido:', orderId);
    return;
  }

  const ambienteFallback = extra.ambiente || null;
  const { chave, numero, protocolo, status, ambiente } =
    mapResumoToOrderNfeFields(resumo, ambienteFallback);

  const plugnotasId = extra.plugnotasId || resumo.id || resumo.idNota || null;
  const xmlUrl = extra.xmlUrl || null;
  const danfeUrl = extra.danfeUrl || null;

  const sets = [];
  const args = [];
  let ai = 1;

  if (status) {
    sets.push(`nfe_status = $${ai++}`);
    args.push(status);
  }
  if (chave) {
    sets.push(`nfe_key = $${ai++}`);
    args.push(chave);
  }
  if (numero != null) {
    sets.push(`nfe_number = $${ai++}`);
    args.push(numero);
  }
  if (protocolo) {
    sets.push(`nfe_protocol = $${ai++}`);
    args.push(protocolo);
  }
  if (ambiente) {
    sets.push(`nfe_environment = $${ai++}`);
    args.push(ambiente);
  }
  if (plugnotasId) {
    sets.push(`nfe_plugnotas_id = $${ai++}`);
    args.push(String(plugnotasId));
  }
  if (xmlUrl) {
    sets.push(`nfe_xml_url = $${ai++}`);
    args.push(xmlUrl);
  }
  if (danfeUrl) {
    sets.push(`nfe_danfe_url = $${ai++}`);
    args.push(danfeUrl);
  }

  if (!sets.length) {
    console.log('[NFE] updateOrderNfeInfo: nada para atualizar (sem campos válidos).');
    return;
  }

  const sql = `
    UPDATE public."orders"
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE order_id = $${ai}
  `;
  args.push(id);

  try {
    await pool.query(sql, args);
    console.log(
      `[NFE] Pedido ${id} atualizado com info da NF-e (status=${status || 'N/D'
      }, numero=${numero || 'N/D'})`,
    );
  } catch (e) {
    console.error(
      '[NFE] Falha ao atualizar orders com dados da NFe:',
      e.message || e,
    );
  }
}

export async function reconcileOrderNfe(orderId) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'orderId inválido' };
  }

  const { rows } = await pool.query(
    `
      SELECT order_id, nfe_plugnotas_id, nfe_key, nfe_environment
      FROM public."orders"
      WHERE order_id = $1
    `,
    [id],
  );

  if (!rows.length) {
    return { ok: false, error: 'PEDIDO_NAO_ENCONTRADO' };
  }

  const row = rows[0];
  const idConsulta = row.nfe_plugnotas_id || row.nfe_key;

  if (!idConsulta) {
    return { ok: false, error: 'SEM_IDENTIFICADOR_NFE' };
  }

  const res = await consultarNFe(idConsulta);
  if (!res.ok) {
    return res;
  }

  const ambiente = row.nfe_environment || null;
  const remote = Array.isArray(res.data) ? res.data[0] : res.data || {};

  await updateOrderNfeInfo(id, remote, {
    plugnotasId: row.nfe_plugnotas_id || null,
    ambiente,
  });

  const statusRemoto =
    remote?.situacao ||
    remote?.status ||
    remote?.statusNfe ||
    remote?.situacaoNfe ||
    '';

  if (toUpperSafe(statusRemoto) === 'AUTORIZADA') {
    try {
      if (typeof stockFromOrdersService.applyStockFromOrder === 'function') {
        const r = await stockFromOrdersService.applyStockFromOrder(id);
        console.log('[NFE] Estoque atualizado para pedido', id, r);
      } else {
        console.warn(
          '[NFE] applyStockFromOrder não encontrado em stockFromOrdersService.js',
        );
      }
    } catch (e) {
      console.error('[NFE] Falha ao ajustar estoque:', e);
    }
  }

  return { ok: true, data: res.data };
}
