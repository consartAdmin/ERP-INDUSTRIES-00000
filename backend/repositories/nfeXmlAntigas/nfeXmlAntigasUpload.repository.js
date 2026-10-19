// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeXmlAntigasUpload.repository.js — upload em lote de XML antigas    ║
// ║ Tabela: public."nfeXmlAntigas" (ON CONFLICT access_key DO NOTHING)   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { parseNfeXmlAntigas } from '../../services/nfeXmlAntigasParser.js';
import { TB } from './nfeXmlAntigas.constants.js';

// ╔═══════════════════════════════════════════════════════════════════╗
// ║ UPLOAD EM LOTE DE XML ANTIGAS                                   ║
// ╚═══════════════════════════════════════════════════════════════════╝

export async function uploadNfeXmlAntigasFiles(files) {
  const imported = [];
  const skipped = [];
  const errors = [];

  for (const file of files) {
    try {
      const xml = file.buffer.toString('utf-8');
      const parsed = await parseNfeXmlAntigas(xml);

      if (!parsed.access_key) {
        throw new Error('XML sem chave de acesso (Id da NFe).');
      }

      const sql = `
        INSERT INTO ${TB} (
          access_key,
          environment,
          model,
          series,
          number,
          issue_date,
          emitter_cnpj,
          emitter_name,
          dest_cnpj_cpf,
          dest_name,
          operation_nature,
          total_value,
          status_sefaz,
          status_desc,
          xml_original
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15
        )
        ON CONFLICT (access_key) DO NOTHING
        RETURNING id
      `;

      const params = [
        parsed.access_key,
        parsed.environment,
        parsed.model,
        parsed.series,
        parsed.number,
        parsed.issue_date,
        parsed.emitter_cnpj,
        parsed.emitter_name,
        parsed.dest_cnpj_cpf,
        parsed.dest_name,
        parsed.operation_nature,
        parsed.total_value,
        parsed.status_sefaz,
        parsed.status_desc,
        parsed.xml_original
      ];

      const result = await pool.query(sql, params);

      if (result.rowCount) {
        imported.push(parsed.access_key);
      } else {
        // Já existia (conflito na chave)
        skipped.push(parsed.access_key);
      }
    } catch (err) {
      console.error('[uploadNfeXmlAntigasFiles] Erro em arquivo:', file.originalname, err);
      errors.push({
        fileName: file.originalname,
        error: err.message
      });
    }
  }

  return {
    imported,
    skipped,
    errors,
    totalProcessed: files.length
  };
}
