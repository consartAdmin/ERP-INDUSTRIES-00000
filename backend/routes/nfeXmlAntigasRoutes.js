// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigasRoutes.js — Rotas NF-e XML Antigas (Repositório)       ║
// ║ CONSART ERP — Upload, listagem, detalhes e deleção de XML           ║
// ║ Base: /api/nfe-xml-antigas                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import multer from 'multer';

// Serviço de negócio (a ser criado em backend/services/apis/nfeXmlAntigasApi.js)
import {
  listNfeXmlAntigas,
  getNfeXmlAntigasByAccessKey,
  uploadNfeXmlAntigasFiles,
  deleteNfeXmlAntigasByAccessKey
} from '../repositories/nfeXmlAntigas/nfeXmlAntigas.index.js';

const router = express.Router();

// ╔══════════════════════════════════════════════════════════════╗
// ║ Configuração do Multer (upload em memória)                   ║
// ║ - Usado somente para upload de arquivos XML antigos          ║
// ╚══════════════════════════════════════════════════════════════╝

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB por arquivo
    files: 100                  // até 100 XML por requisição
  }
});

// Helper para resposta de erro padrão
function sendError(res, status, message, details = null) {
  return res.status(status).json({
    ok: false,
    message,
    details
  });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║ GET /api/nfe-xml-antigas                                    ║
// ║ Lista NF-e antigas com filtros e paginação                   ║
// ║ Query params:                                                ║
// ║   page, pageSize, q, accessKey, cnpj, startDate, endDate,    ║
// ║   number, series, status                                     ║
// ╚══════════════════════════════════════════════════════════════╝

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      q = '',
      accessKey = '',
      cnpj = '',
      startDate = '',
      endDate = '',
      number = '',
      series = '',
      status = ''
    } = req.query;

    const filters = {
      q: String(q || '').trim(),
      accessKey: String(accessKey || '').trim(),
      cnpj: String(cnpj || '').replace(/\D/g, ''),
      startDate: startDate || '',
      endDate: endDate || '',
      number: number ? Number(number) : null,
      series: String(series || '').trim(),
      status: String(status || '').trim()
    };

    const pagination = {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20
    };

    const result = await listNfeXmlAntigas(filters, pagination);

    return res.json({
      ok: true,
      ...result
    });
  } catch (err) {
    console.error('[nfeXmlAntigasRoutes] Erro GET /:', err);
    return sendError(res, 500, 'Erro ao listar NF-e antigas.', err.message);
  }
});

// ╔══════════════════════════════════════════════════════════════╗
// ║ GET /api/nfe-xml-antigas/:accessKey                         ║
// ║ Retorna detalhes de uma NF-e antiga pela chave de acesso    ║
// ╚══════════════════════════════════════════════════════════════╝

router.get('/:accessKey', async (req, res) => {
  try {
    const { accessKey } = req.params;

    if (!accessKey || accessKey.length < 10) {
      return sendError(res, 400, 'Chave de acesso inválida.');
    }

    const nfe = await getNfeXmlAntigasByAccessKey(accessKey);

    if (!nfe) {
      return sendError(res, 404, 'NF-e não encontrada no repositório de antigas.');
    }

    return res.json({
      ok: true,
      data: nfe
    });
  } catch (err) {
    console.error('[nfeXmlAntigasRoutes] Erro GET /:accessKey', err);
    return sendError(res, 500, 'Erro ao buscar NF-e antiga.', err.message);
  }
});

// ╔══════════════════════════════════════════════════════════════╗
// ║ POST /api/nfe-xml-antigas/upload                            ║
// ║ Upload em lote de arquivos XML antigos                      ║
// ║ Campo do formulário: xmlFiles (múltiplos arquivos)          ║
// ╚══════════════════════════════════════════════════════════════╝

router.post(
  '/upload',
  upload.array('xmlFiles', 100),
  async (req, res) => {
    try {
      const files = req.files || [];

      if (!files.length) {
        return sendError(res, 400, 'Nenhum arquivo XML enviado.');
      }

      const result = await uploadNfeXmlAntigasFiles(files);

      return res.status(201).json({
        ok: true,
        message: 'Importação de XML antigas concluída.',
        ...result
      });
    } catch (err) {
      console.error('[nfeXmlAntigasRoutes] Erro POST /upload', err);
      return sendError(res, 500, 'Erro ao importar XML antigas.', err.message);
    }
  }
);

// ╔══════════════════════════════════════════════════════════════╗
// ║ DELETE /api/nfe-xml-antigas/:accessKey                      ║
// ║ Remove uma NF-e antiga específica pelo accessKey            ║
// ╚══════════════════════════════════════════════════════════════╝

router.delete('/:accessKey', async (req, res) => {
  try {
    const { accessKey } = req.params;

    if (!accessKey || accessKey.length < 10) {
      return sendError(res, 400, 'Chave de acesso inválida.');
    }

    const deleted = await deleteNfeXmlAntigasByAccessKey(accessKey);

    if (!deleted) {
      return sendError(res, 404, 'NF-e não encontrada ou já removida.');
    }

    return res.json({
      ok: true,
      message: 'NF-e antiga removida com sucesso.'
    });
  } catch (err) {
    console.error('[nfeXmlAntigasRoutes] Erro DELETE /:accessKey', err);
    return sendError(res, 500, 'Erro ao remover NF-e antiga.', err.message);
  }
});

export default router;
