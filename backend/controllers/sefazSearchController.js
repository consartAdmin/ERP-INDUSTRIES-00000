// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sefazSearchController.js — Controllers de busca SEFAZ (CNPJ / IE)   ║
// ║ CONSART ERP — Camada HTTP (Express)                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import sefazApi from '../repositories/sefaz/sefaz.index.js';

function onlyDigits(v = '') {
  return String(v).replace(/\D+/g, '');
}

/**
 * GET /api/search/sefaz/cnpj/:cnpj?uf=MG
 * Retorna:
 *   { ok: true, data: {...} }
 * onde data contém: nome, fantasia, inscricao_estadual, endereço, etc.
 */
export async function searchByCnpj(req, res) {
  try {
    const rawCnpj = req.params.cnpj || '';
    const uf      = req.query.uf || null;

    const cnpjDigits = onlyDigits(rawCnpj);
    if (cnpjDigits.length !== 14) {
      return res.status(400).json({
        ok: false,
        erro: 'CNPJ inválido. Informe 14 dígitos.'
      });
    }

    const data = await sefazApi.searchSefazByCnpj({
      cnpj: cnpjDigits,
      uf
    });

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[SEFAZ][CNPJ] Erro:', err.message || err);
    return res.status(502).json({
      ok: false,
      erro: 'Falha ao consultar SEFAZ/provedor.',
      detalhe: process.env.NODE_ENV === 'development' ? String(err.message || err) : undefined
    });
  }
}

/**
 * GET /api/search/sefaz/ie/:uf/:ie
 * Permite consulta também partindo da IE + UF.
 * Devolve o MESMO formato ({ ok, data }) para ser reutilizável.
 */
export async function searchByIe(req, res) {
  try {
    const uf  = (req.params.uf || '').toUpperCase();
    const ie  = req.params.ie || '';

    if (!uf || uf.length !== 2) {
      return res.status(400).json({
        ok: false,
        erro: 'UF inválida. Ex: MG, SP, RJ...'
      });
    }

    const data = await sefazApi.searchSefazByIe({ uf, ie });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[SEFAZ][IE] Erro:', err.message || err);
    return res.status(502).json({
      ok: false,
      erro: 'Falha ao consultar SEFAZ/provedor (IE).',
      detalhe: process.env.NODE_ENV === 'development' ? String(err.message || err) : undefined
    });
  }
}
