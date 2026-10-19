// ╔═════════════════════════════════════════════════════════════════════════════╗
// ║ searchSefazRoutes.js — Consulta CNPJ (Receita Federal / SEFAZ Proxy)       ║
// ║ Permite busca pública via fetch → receitaws.com.br/v1/cnpj/:cnpj            ║
// ║ Compatível com layout e apiBase padrão CONSART ERP                           ║
// ╚═════════════════════════════════════════════════════════════════════════════╝

import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * 🔹 GET /api/search/sefaz/cnpj/:cnpj
 * Consulta os dados do CNPJ na base pública ReceitaWS (proxy SEFAZ)
 */
router.get('/cnpj/:cnpj', async (req, res) => {
  const { cnpj } = req.params;
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (!/^\d{14}$/.test(cleanCnpj)) {
    return res.status(400).json({ ok: false, erro: 'CNPJ inválido.' });
  }

  try {
    // Fonte pública compatível com Receita Federal (API ReceitaWS)
    const url = `https://receitaws.com.br/v1/cnpj/${cleanCnpj}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await response.json();

    if (!response.ok || data.status === 'ERROR') {
      throw new Error(data.message || 'Falha ao consultar ReceitaWS');
    }

    // Normaliza resposta principal
    res.json({
      ok: true,
      fonte: 'receitaws.com.br',
      data: {
        nome: data.nome,
        fantasia: data.fantasia,
        cnpj: data.cnpj,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        telefone: data.telefone,
        email: data.email,
        situacao: data.situacao,
        abertura: data.abertura,
        natureza_juridica: data.natureza_juridica,
        capital_social: data.capital_social,
        atividade_principal: data.atividade_principal?.[0]?.text || '',
        atividades_secundarias: data.atividades_secundarias?.map((a) => a.text) || []
      }
    });
  } catch (err) {
    console.error('[SEFAZ][CNPJ][ERRO]', err);
    res.status(500).json({ ok: false, erro: err.message || 'Erro interno na consulta SEFAZ' });
  }
});

export default router;
