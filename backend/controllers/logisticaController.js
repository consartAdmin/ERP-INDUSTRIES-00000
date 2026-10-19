// ╔════════════════════════════════════════════════════════════════╗
// ║ 📦 logisticaController.js – CRUD de Entregas e Coletas        ║
// ╚════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import moment from 'moment';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// ⚠️ Ajuste conforme seu export em ../config/db.js:
// - export default pool → use "import pool from '../config/db.js'"
// - export const pool = ... → use "import { pool } from '../config/db.js'"
import pool from '../config/db.js';

// __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 📥 Criar nova entrega/coleta
export async function criar(req, res) {
  try {
    const {
      cliente_nome, tipo, endereco, cidade, uf,
      data_prevista, observacoes, ordem_entrega, ordem // <- aceita "ordem" também
    } = req.body;

    // prioriza "ordem" do frontend; se não vier, usa "ordem_entrega"; se não vier, calcula próxima
    let ordemFinal = ordem ?? ordem_entrega ?? null;

    if (!ordemFinal) {
      const { rows } = await pool.query(
        `SELECT COALESCE(MAX(ordem_entrega), 0) AS ultima
           FROM entregas_logistica
          WHERE data_prevista = $1`,
        [data_prevista]
      );
      ordemFinal = Number(rows[0].ultima) + 1;
    }

    const { rows: inseridos } = await pool.query(
      `INSERT INTO entregas_logistica
         (cliente_nome, tipo, endereco, cidade, uf, data_prevista, observacoes, ordem_entrega)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *;`,
      [cliente_nome, tipo, endereco, cidade, uf, data_prevista, observacoes, ordemFinal]
    );

    res.status(201).json(inseridos[0]);
  } catch (err) {
    console.error('Erro ao criar entrega:', err);
    res.status(500).json({ erro: 'Erro ao salvar entrega' });
  }
}

// 📄 Listar entregas/coletas
export async function listar(_req, res) {
  try {
    const resultado = await pool.query(`
      SELECT * FROM entregas_logistica 
      ORDER BY ordem_entrega ASC NULLS LAST, data_prevista ASC
    `);
    res.json(resultado.rows);
  } catch (err) {
    console.error('Erro ao listar entregas:', err);
    res.status(500).json({ erro: 'Erro ao carregar entregas' });
  }
}

// ✅ Atualizar status
export async function atualizarStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      'UPDATE entregas_logistica SET status = $1 WHERE id = $2',
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Entrega não encontrada' });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('[ERRO] atualizarStatus:', err);
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
}

// 💾 Atualizar entrega
export async function atualizarEntrega(req, res) {
  console.log('[DEBUG] Corpo da Requisição (atualizarEntrega):', req.body);
  const { id } = req.params;
  const {
    cliente_nome,
    tipo,
    endereco,
    cidade,
    uf,
    data_prevista,
    status,
    observacoes,
    ordem // 👈 captura corretamente do corpo
  } = req.body;

  try {
    await pool.query(
      `UPDATE entregas_logistica SET
         cliente_nome = $1,
         tipo = $2,
         endereco = $3,
         cidade = $4,
         uf = $5,
         data_prevista = $6,
         status = $7,
         observacoes = $8,
         ordem_entrega = $9
       WHERE id = $10`,
      [
        cliente_nome,
        tipo,
        endereco,
        cidade,
        uf,
        data_prevista,
        status,
        observacoes,
        ordem,   // 👈 finalmente gravando corretamente
        id
      ]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error('[ERRO] atualizarEntrega:', err);
    res.status(500).json({ erro: 'Erro ao atualizar entrega' });
  }
}

// 🗑️ Remover Entrega
export async function removerEntrega(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM entregas_logistica WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ erro: 'Entrega não encontrada' });
    }
    res.sendStatus(204);
  } catch (err) {
    console.error('[ERRO] removerEntrega:', err);
    res.status(500).json({ erro: 'Erro ao remover entrega' });
  }
}

// 📄 Gerar PDF da Rota
export async function gerarPDF(req, res) {
  const data = req.params.data;

  try {
    const resultado = await pool.query(
      `SELECT * FROM entregas_logistica 
       WHERE data_prevista = $1
       ORDER BY ordem_entrega ASC NULLS LAST, data_prevista ASC`,
      [data]
    );

    const registros = resultado.rows;
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      const nomeArquivo = `ROTA_${moment(data).format('YYYY-MM-DD')}_TOTAL${registros.length}.pdf`;
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomeArquivo}"`,
        'Content-Length': pdfData.length
      });
      res.end(pdfData);
    });

    const caminhoLogo = path.join(__dirname, '../../public/imagens/logoconsart.png');
    function inserirMarcaDagua() {
      if (fs.existsSync(caminhoLogo)) {
        const largura = 180;
        const x = (doc.page.width - largura) / 2;
        const y = (doc.page.height - largura) / 2;
        doc.save();
        doc.opacity(0.07);
        doc.image(caminhoLogo, x, y, { width: largura });
        doc.opacity(1);
        doc.restore();
      }
    }

    inserirMarcaDagua();

    const startX = 40;
    const endX = doc.page.width - 40;
    const rowHeight = 24;
    let y = doc.y;

    doc.font('Helvetica-Bold').fontSize(14).text('BH3 DISTRIBUIDORA DE PRODUTOS DE LIMPEZA LTDA', { align: 'center' });
    doc.font('Helvetica').fontSize(10)
      .text('CNPJ: 34.363.337/0001-85', { align: 'center' })
      .text('AV. BIAS FORTES 784, LOURDES – CEP 30.170-012', { align: 'center' })
      .text('Telefone: (31) 3566-0070 / (31) 3566-8888', { align: 'center' })
      .text('E-mail: vendas@bh3distribuidora.com.br | Site: www.bh3distribuidora.com.br', { align: 'center' });

    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(12).text(`ROTA DO DIA – ${moment(data).format('DD/MM/YYYY')}`, { align: 'center' });
    doc.moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Total de registros: ${registros.length}`, { align: 'left' });
    y = doc.y + 10;

    const headers = ['Ordem', 'Tipo', 'Cliente', 'Endereço', 'Cidade', 'UF', 'Status', 'Observações'];
    const colWidths = [45, 50, 120, 200, 90, 30, 70, 180];

    function desenharCabecalhoTabela(yPos) {
      let x = startX;
      doc.font('Helvetica-Bold').fontSize(9);
      headers.forEach((h, i) => {
        doc.rect(x, yPos, colWidths[i], rowHeight).stroke();
        doc.text(h, x + 4, yPos + 7, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });
      return yPos + rowHeight;
    }

    y = desenharCabecalhoTabela(y);
    doc.font('Helvetica').fontSize(8);

    registros.forEach((reg) => {
      const dados = [
        reg.ordem_entrega || '-',
        (reg.tipo || '').toUpperCase(),
        reg.cliente_nome || '',
        reg.endereco || '',
        reg.cidade || '',
        reg.uf || '',
        reg.status || '',
        reg.observacoes || ''
      ];

      if (y + rowHeight > doc.page.height - 50) {
        doc.addPage({ size: 'A4', layout: 'landscape' });
        inserirMarcaDagua();
        y = 40;
        y = desenharCabecalhoTabela(y);
        doc.font('Helvetica').fontSize(8);
      }

      let x = startX;
      dados.forEach((val, i) => {
        doc.rect(x, y, colWidths[i], rowHeight).stroke();
        doc.text(String(val ?? ''), x + 4, y + 7, { width: colWidths[i] - 8 });
        x += colWidths[i];
      });

      y += rowHeight;
    });

    if (y + 60 > doc.page.height - 40) {
      doc.addPage({ size: 'A4', layout: 'landscape' });
      inserirMarcaDagua();
      y = 40;
    }

    const conferidoX = doc.page.width - 240;
    doc.font('Helvetica').fontSize(9).text('Conferido por:', conferidoX, y + 10);
    doc.moveTo(conferidoX, y + 22).lineTo(conferidoX + 180, y + 22).stroke();

    doc.end();
  } catch (err) {
    console.error('❌ Erro ao gerar PDF da Rota:', err);
    res.status(500).json({ erro: 'Erro ao gerar PDF' });
  }
}
