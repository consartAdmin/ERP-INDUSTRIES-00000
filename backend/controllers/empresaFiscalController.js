// ╔════════════════════════════════════════════════════════════════════════════════════╗
// ║ 📁 empresaFiscalController.js – Controller: Informações Fiscais da Empresa (ESM)  ║
/* ╚════════════════════════════════════════════════════════════════════════════════════╝
   - Alinhado ao schema public."empresaFiscal" (camelCase com aspas)
   - Saneia e valida payload de acordo com seus CHECK CONSTRAINTS
   - Trata erros de FK/UNIQUE/CHECK (23503 / 23505 / 23514)
*/

import pool from '../config/db.js';

// ───────────────────────── helpers ─────────────────────────
const onlyDigits = (v) => (v ?? '').toString().replace(/\D+/g, '');
const toUpper2 = (v) => (v ?? '').toString().trim().toUpperCase();
const toNull = (v) => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
};

// Mapeia legado "regime_tributario" -> CRT (1,2,3)
function parseCRT(body) {
  if (body?.crt !== undefined && body.crt !== null && body.crt !== '') {
    const n = Number(body.crt);
    return [1, 2, 3].includes(n) ? n : 3;
  }
  const rt = (body?.regime_tributario || '').toString().toLowerCase();
  if (rt.includes('excesso')) return 2;
  if (rt.includes('simples')) return 1;
  // Lucro Presumido/Real => Regime Normal
  return 3;
}

// Validação coerente com CHECKs do banco
function validarPayload(p) {
  if (!p.razao_social) return 'Razão social é obrigatória.';
  if (!p.cnpj || p.cnpj.length !== 14) return 'CNPJ deve conter 14 dígitos numéricos.';

  if (![1, 2, 3].includes(p.crt)) return 'CRT inválido. Use 1, 2 ou 3.';

  if (!p.logradouro) return 'Logradouro é obrigatório.';
  if (!p.numero) return 'Número é obrigatório.';
  if (!p.bairro) return 'Bairro é obrigatório.';

  if (!p.cod_municipio_ibge || p.cod_municipio_ibge.length !== 7) {
    return 'Código IBGE do município deve conter 7 dígitos.';
  }
  if (!p.municipio) return 'Município é obrigatório.';

  if (!p.uf || !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(p.uf)) {
    return 'UF inválida.';
  }

  if (!p.cep || p.cep.length !== 8) return 'CEP deve conter 8 dígitos.';
  if (p.cnae_principal && p.cnae_principal.length !== 7) return 'CNAE principal deve conter 7 dígitos.';
  if (p.telefone && (p.telefone.length < 10 || p.telefone.length > 11)) {
    return 'Telefone deve ter 10 ou 11 dígitos.';
  }
  if (p.responsavel_telefone && (p.responsavel_telefone.length < 10 || p.responsavel_telefone.length > 11)) {
    return 'Telefone do responsável deve ter 10 ou 11 dígitos.';
  }
  return null;
}

function normalizarEntrada(body) {
  const payload = {
    // flags
    ativo: body?.ativo !== undefined ? !!body.ativo : true,

    // identificação
    razao_social: (body?.razao_social || '').toString().trim(),
    nome_fantasia: toNull(body?.nome_fantasia),
    cnpj: onlyDigits(body?.cnpj),

    // inscrições
    inscricao_estadual: toNull(onlyDigits(body?.inscricao_estadual)),
    inscricao_municipal: toNull(body?.inscricao_municipal),

    // regime
    crt: parseCRT(body),

    // cnae
    cnae_principal: toNull(onlyDigits(body?.cnae_principal)),

    // endereço fiscal (NOT NULL)
    logradouro: (body?.logradouro || '').toString().trim(),
    numero: (body?.numero || '').toString().trim(),
    complemento: toNull(body?.complemento),
    bairro: (body?.bairro || '').toString().trim(),
    cod_municipio_ibge: onlyDigits(body?.cod_municipio_ibge),
    municipio: (body?.municipio || '').toString().trim(),
    uf: toUpper2(body?.uf).slice(0, 2),
    cep: onlyDigits(body?.cep),

    // contato
    telefone: toNull(onlyDigits(body?.telefone)),
    email: toNull(body?.email),

    // responsável técnico
    responsavel_nome: toNull(body?.responsavel_nome),
    responsavel_crc: toNull(body?.responsavel_crc),
    responsavel_email: toNull(body?.responsavel_email),
    responsavel_telefone: toNull(onlyDigits(body?.responsavel_telefone)),

    // certificado
    caminho_certificado: toNull(body?.caminho_certificado),
    senha_certificado: toNull(body?.senha_certificado),

    // FK
    perfil_fiscal_id: body?.perfil_fiscal_id ? Number(body.perfil_fiscal_id) : null
  };

  return payload;
}

// Tradução amigável de erros PG
function traduzErroPg(e) {
  if (!e || !e.code) return null;
  if (e.code === '23505') return 'CNPJ já cadastrado.';
  if (e.code === '23503') return 'Perfil fiscal inválido (violação de chave estrangeira).';
  if (e.code === '23514') {
    // checagens conhecidas
    const name = e.constraint || '';
    if (name.includes('cnpj')) return 'CNPJ inválido (deve conter 14 dígitos).';
    if (name.includes('cep')) return 'CEP inválido (deve conter 8 dígitos).';
    if (name.includes('cnae')) return 'CNAE principal inválido (7 dígitos).';
    if (name.includes('uf')) return 'UF inválida.';
    if (name.includes('tel')) return 'Telefone inválido (10 ou 11 dígitos).';
    if (name.includes('resp_tel')) return 'Telefone do responsável inválido (10 ou 11 dígitos).';
    if (name.includes('crt')) return 'CRT inválido (deve ser 1, 2 ou 3).';
    if (name.includes('cpais')) return 'cPais inválido (3 a 4 dígitos).';
    return 'Dados inválidos (violação de restrição).';
  }
  return null;
}

// ╭───────────────────────────────────────────────────────────────╮
// │ 🔍 Listar todas as empresas fiscais                           │
// ╰───────────────────────────────────────────────────────────────╯
export async function listar(_req, res) {
  try {
    const r = await pool.query('SELECT * FROM "empresaFiscal" ORDER BY id;');
    res.json(r.rows);
  } catch (e) {
    console.error('❌ Erro ao listar empresas fiscais:', e);
    res.status(500).json({ erro: 'Erro ao listar empresas fiscais.' });
  }
}

// ╭───────────────────────────────────────────────────────────────╮
// │ 🔎 Buscar por ID                                              │
// ╰───────────────────────────────────────────────────────────────╯
export async function buscarPorId(req, res) {
  try {
    const r = await pool.query('SELECT * FROM "empresaFiscal" WHERE id = $1;', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ erro: 'Empresa fiscal não encontrada.' });
    res.json(r.rows[0]);
  } catch (e) {
    console.error('❌ Erro ao buscar empresa fiscal:', e);
    res.status(500).json({ erro: 'Erro ao buscar empresa fiscal.' });
  }
}

// ╭───────────────────────────────────────────────────────────────╮
// │ 💾 Criar nova empresa fiscal                                  │
// ╰───────────────────────────────────────────────────────────────╯
export async function criar(req, res) {
  try {
    const p = normalizarEntrada(req.body);
    const erro = validarPayload(p);
    if (erro) return res.status(400).json({ erro });

    const sql = `
      INSERT INTO "empresaFiscal" (
        ativo, razao_social, nome_fantasia, cnpj, inscricao_estadual, inscricao_municipal, crt,
        cnae_principal, logradouro, numero, complemento, bairro, cod_municipio_ibge, municipio, uf, cep,
        telefone, email, responsavel_nome, responsavel_crc, responsavel_email, responsavel_telefone,
        caminho_certificado, senha_certificado, perfil_fiscal_id
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,
        $23,$24,$25
      )
      RETURNING *;`;

    const params = [
      p.ativo, p.razao_social, p.nome_fantasia, p.cnpj, p.inscricao_estadual, p.inscricao_municipal, p.crt,
      p.cnae_principal, p.logradouro, p.numero, p.complemento, p.bairro, p.cod_municipio_ibge, p.municipio, p.uf, p.cep,
      p.telefone, p.email, p.responsavel_nome, p.responsavel_crc, p.responsavel_email, p.responsavel_telefone,
      p.caminho_certificado, p.senha_certificado, p.perfil_fiscal_id
    ];

    const r = await pool.query(sql, params);
    res.status(201).json(r.rows[0]);
  } catch (e) {
    const friendly = traduzErroPg(e);
    if (friendly) return res.status(400).json({ erro: friendly });
    console.error('❌ Erro ao criar empresa fiscal:', e);
    res.status(500).json({ erro: 'Erro ao criar empresa fiscal.' });
  }
}

// ╭───────────────────────────────────────────────────────────────╮
// │ ✏️ Editar por ID                                              │
// ╰───────────────────────────────────────────────────────────────╯
export async function editar(req, res) {
  const { id } = req.params;
  try {
    const p = normalizarEntrada(req.body);
    const erro = validarPayload(p);
    if (erro) return res.status(400).json({ erro });

    const sql = `
      UPDATE "empresaFiscal" SET
        ativo=$1, razao_social=$2, nome_fantasia=$3, cnpj=$4, inscricao_estadual=$5, inscricao_municipal=$6, crt=$7,
        cnae_principal=$8, logradouro=$9, numero=$10, complemento=$11, bairro=$12, cod_municipio_ibge=$13,
        municipio=$14, uf=$15, cep=$16, telefone=$17, email=$18, responsavel_nome=$19, responsavel_crc=$20,
        responsavel_email=$21, responsavel_telefone=$22, caminho_certificado=$23, senha_certificado=$24,
        perfil_fiscal_id=$25
      WHERE id=$26
      RETURNING *;`;

    const params = [
      p.ativo, p.razao_social, p.nome_fantasia, p.cnpj, p.inscricao_estadual, p.inscricao_municipal, p.crt,
      p.cnae_principal, p.logradouro, p.numero, p.complemento, p.bairro, p.cod_municipio_ibge,
      p.municipio, p.uf, p.cep, p.telefone, p.email, p.responsavel_nome, p.responsavel_crc,
      p.responsavel_email, p.responsavel_telefone, p.caminho_certificado, p.senha_certificado,
      p.perfil_fiscal_id, id
    ];

    const r = await pool.query(sql, params);
    if (!r.rowCount) return res.status(404).json({ erro: 'Empresa fiscal não encontrada para edição.' });
    res.json(r.rows[0]);
  } catch (e) {
    const friendly = traduzErroPg(e);
    if (friendly) return res.status(400).json({ erro: friendly });
    console.error('❌ Erro ao editar empresa fiscal:', e);
    res.status(500).json({ erro: 'Erro ao editar empresa fiscal.' });
  }
}

// ╭───────────────────────────────────────────────────────────────╮
// │ ❌ Excluir por ID                                             │
// ╰───────────────────────────────────────────────────────────────╯
export async function excluir(req, res) {
  try {
    const r = await pool.query('DELETE FROM "empresaFiscal" WHERE id = $1 RETURNING id;', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ erro: 'Empresa fiscal não encontrada para exclusão.' });
    res.json({ mensagem: 'Empresa fiscal excluída com sucesso.' });
  } catch (e) {
    console.error('❌ Erro ao excluir empresa fiscal:', e);
    res.status(500).json({ erro: 'Erro ao excluir empresa fiscal.' });
  }
}
