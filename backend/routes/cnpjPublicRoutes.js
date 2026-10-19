// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cnpjPublicRoutes.js — Rotas de Consulta Pública CNPJ                 ║
// ║ CONSART ERP / CONSART-PJ                                             ║
// ║ GET /api/public-cnpj/:cnpj                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import { consultarCnpjPublic } from '../repositories/cnpjPublic/cnpjPublic.index.js';

const router = Router();

/**
 * @route  GET /api/public-cnpj/:cnpj
 * @desc   Consulta CNPJ em API pública e retorna dados cadastrais
 * @exemplo /api/public-cnpj/08187168000160
 */
router.get('/:cnpj', async (req, res) => {
  const { cnpj } = req.params;

  try {
    const data = await consultarCnpjPublic(cnpj);

    // Se quiser padronizar a resposta:
    // const result = {
    //   cnpj: data.cnpj,
    //   razaoSocial: data.razao_social || data.nome || '',
    //   nomeFantasia: data.nome_fantasia || '',
    //   endereco: {
    //     logradouro: data.logradouro,
    //     numero: data.numero,
    //     bairro: data.bairro,
    //     cep: data.cep,
    //     municipio: data.municipio,
    //     uf: data.uf
    //   },
    //   cnaePrincipal: data.cnae_fiscal || '',
    //   situacaoCadastral: data.situacao_cadastral || '',
    //   // ...
    // };
    //
    // return res.json(result);

    return res.json(data);
  } catch (error) {
    console.error('[cnpjPublicRoutes] Erro na consulta CNPJ:', error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: true,
      message: error.message || 'Erro interno ao consultar CNPJ.'
    });
  }
});

export default router;
