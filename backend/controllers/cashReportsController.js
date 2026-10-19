// ╔══════════════════════════════════════════════════════════════════════╗
// ║
// ║
// ║     backend/controllers/cashReportsController.js                     ║
// ║                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import moment from 'moment';

import { generateCaixaPdf } from '../generationPdf/generationCashMovimentsPdf.js';
import { listForPdf } from '../services/apis/caixaApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export async function relatorioCaixaPdf(req, res, next) {
  try {
    // Mesmos nomes que o front usa
    const {
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
    } = req.query;

    // 1) Busca todas as linhas para o PDF (já vem com tem_anexo!)
    const rows = await listForPdf({
      date_from,
      date_to,
      tipo,
      conta,
      categoria,
      subcategoria,
      search,
    });

    // (opcional) log de conferência
    console.log(
      '[Caixa][relatorioCaixaPdf] primeiras linhas:',
      rows.slice(0, 10).map(r => ({
        id: r.id,
        data_hora: r.data_hora,
        tem_anexo: r.tem_anexo,
      })),
    );

    // 2) Dados da empresa
    const company = {
      name: 'BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA',
      cnpj: '34.363.337/0001-85',
      address: 'AV. BIAS FORTES 784, LOURDES – CEP 30.170-012',
      contacts: 'Telefone: (31) 3566-0070 / (31) 3566-8888',
      site: 'E-mail: vendas@bh3distribuidora.com.br | Site: www.bh3distribuidora.com.br',
      logoPath: path.resolve(__dirname, '../../public/imagens/logoconsart.png'),
      paperclipPath: path.resolve(__dirname, '../../public/imagens/paperclip.png'),
    };

    const periodoLabel =
      (date_from && date_to)
        ? `${moment(date_from).format('YYYY-MM-DD')}_a_${moment(date_to).format('YYYY-MM-DD')}`
        : `${date_from || 'ini'}_a_${date_to || 'fim'}`;

    // 3) Gera o PDF na resposta HTTP
    await generateCaixaPdf(
      { rows, title: 'Relatório de Movimentações de Caixa', company },
      { output: 'response', res, filename: `relatorio_caixa_${periodoLabel}.pdf` },
    );
  } catch (err) {
    console.error('[Caixa][relatorioCaixaPdf] erro:', err);
    next(err);
  }
}
