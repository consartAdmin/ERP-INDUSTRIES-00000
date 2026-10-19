// ╔═════════════════════════════════════════════════════════════════════════════════════╗
// ║ 🧠 backend/controllers/editClientsController.js – Lógica da Edição de Clientes 🧠  ║
// ╚═════════════════════════════════════════════════════════════════════════════════════╝
import pool from '../config/db.js';

/* Utilitário: cria payload de erro padronizado */
function makeErrorPayload(err, req, fallbackMsg = 'Erro interno') {
  const payload = {
    status: 'ERROR',
    message: fallbackMsg,
    code: err?.code || null,
    field: null,
    detail: err?.detail || null,
    requestId: req?.requestId || null,
  };

  // Tradução básica de códigos PG
  switch (err?.code) {
    case '22001': // string data right truncation
      payload.message = 'Valor muito longo para o campo.';
      // tenta inferir tamanho a partir do detail
      if (err.detail) {
        const m = /character varying\((\d+)\)/i.exec(err.detail);
        if (m) payload.detail = `Tamanho máximo permitido: ${m[1]}`;
      }
      break;
    case '23505': // unique_violation
      payload.message = 'Registro duplicado (violação de unicidade).';
      if (err.constraint) payload.detail = `Restrição: ${err.constraint}`;
      break;
    case '23502': // not_null_violation
      payload.message = 'Campo obrigatório não informado.';
      if (err.column) payload.field = err.column;
      break;
    default:
      payload.message = err?.message || fallbackMsg;
  }

  // Tentativa simples de detectar campo pelo texto (ajuda quando o driver não traz column)
  const txt = (err?.message || '') + ' ' + (err?.detail || '');
  if (!payload.field) {
    const hints = ['telefone', 'celular', 'cnpj_cpf', 'email', 'estado', 'numero', 'cep', 'asaas_id'];
    payload.field = hints.find(h => txt.toLowerCase().includes(h)) || null;
  }

  return payload;
}

/* Sanitização/limite de tamanho – Evita 22001 quando possível */
function sanitizeClienteInput(dados = {}) {
  const cap = (v, n) => (v == null ? '' : String(v).slice(0, n));

  // Tamanhos típicos do schema
  return {
    ...dados,
    telefone:   cap(dados.telefone, 20),
    celular:    cap(dados.celular, 20),
    cnpj_cpf:   cap(dados.cnpj_cpf, 20),
    estado:     cap(dados.estado, 2),
    numero:     cap(dados.numero, 10),
    cep:        cap(dados.cep, 9),
    asaas_id:   cap(dados.asaas_id, 40),
    // garante boolean coerente
    ativo:      typeof dados.ativo === 'boolean' ? dados.ativo : String(dados.ativo).toLowerCase() === 'true',
  };
}

/* ===== Buscar por CNPJ/CPF (base interna) ===== */
export const buscarPorCNPJ = async (req, res) => {
  const { cnpj } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clientes WHERE cnpj_cpf = $1 LIMIT 1',
      [cnpj]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Cliente não encontrado',
        requestId: req.requestId || null,
      });
    }
    res.json({ status: 'OK', data: rows[0], requestId: req.requestId || null });
  } catch (err) {
    const payload = makeErrorPayload(err, req, 'Erro ao buscar cliente por CNPJ.');
    console.error('[ERR#CNPJ]', JSON.stringify({ requestId: req.requestId, ...payload }));
    res.status(500).json(payload);
  }
};

/* ===== Buscar por CEP (base interna) ===== */
export const buscarPorCEP = async (req, res) => {
  const { cep } = req.params;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM clientes WHERE cep = $1 LIMIT 1',
      [cep]
    );
    if (rows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'Cliente não encontrado',
        requestId: req.requestId || null,
      });
    }
    res.json({ status: 'OK', data: rows[0], requestId: req.requestId || null });
  } catch (err) {
    const payload = makeErrorPayload(err, req, 'Erro ao buscar cliente por CEP.');
    console.error('[ERR#CEP]', JSON.stringify({ requestId: req.requestId, ...payload }));
    res.status(500).json(payload);
  }
};

/* ===== Atualizar Cliente ===== */
const normOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

export const atualizarCliente = async (req, res) => {
  const { id } = req.params;
  const d = req.body;

  // 🔧 Normalizações leves / nulos
  const clean = (x, n) => (x ? String(x).slice(0, n) : '');
  const onlyDigits = (s) => String(s || '').replace(/\D/g, '');

  const payload = {
    nome_fantasia:        clean(d.nome_fantasia, 120),
    cnpj_cpf:             clean(d.cnpj_cpf, 20),
    inscricao_estadual:   clean(d.inscricao_estadual, 30),
    inscricao_municipal:  clean(d.inscricao_municipal, 30),
    razao_social:         clean(d.razao_social, 120),
    segmento:             clean(d.segmento, 60),
    classificacao:        clean(d.classificacao, 60),
    vendedor:             clean(d.vendedor, 60),
    ativo:                !!d.ativo,
    email:                clean(d.email, 120),
    cep:                  clean(d.cep, 9),
    tipo_logradouro:      clean(d.tipo_logradouro, 20),
    nome_logradouro:      clean(d.nome_logradouro, 120),
    numero:               clean(d.numero, 10),
    complemento:          clean(d.complemento, 60),
    bairro:               clean(d.bairro, 60),
    cidade:               clean(d.cidade, 60),
    estado:               clean(d.estado, 2),
    contato:              clean(d.contato, 60),
    telefone:             clean(d.telefone, 20),
    celular:              clean(d.celular, 20),
    asaas_id:             normOrNull(d.asaas_id), // 👈 vira NULL se vier ''
  };

  const cam = [
    'nome_fantasia','cnpj_cpf','inscricao_estadual','inscricao_municipal',
    'razao_social','segmento','classificacao','vendedor','ativo',
    'email','cep','tipo_logradouro','nome_logradouro','numero',
    'complemento','bairro','cidade','estado',
    'contato','telefone','celular','asaas_id'
  ];
  const valores = cam.map(k => payload[k]);

  const sql = `
    UPDATE clientes SET
      nome_fantasia = $1,
      cnpj_cpf = $2,
      inscricao_estadual = $3,
      inscricao_municipal = $4,
      razao_social = $5,
      segmento = $6,
      classificacao = $7,
      vendedor = $8,
      ativo = $9,
      email = $10,
      cep = $11,
      tipo_logradouro = $12,
      nome_logradouro = $13,
      numero = $14,
      complemento = $15,
      bairro = $16,
      cidade = $17,
      estado = $18,
      contato = $19,
      telefone = $20,
      celular = $21,
      asaas_id = NULLIF($21, ''),
    WHERE cliente_id = $23
  `;

  try {
    await pool.query(sql, [...valores, id]);
    return res.json({ status: 'OK', message: 'Cliente atualizado com sucesso.' });
  } catch (err) {
    // 🎯 Descobre campo pela constraint/mensagem
    let field = null;
    const det = String(err.detail || '').toLowerCase();
    if (det.includes('(cnpj_cpf)')) field = 'cnpj_cpf';
    if (det.includes('(asaas_id)')) field = 'asaas_id';
    if (!field && err.message?.includes('telefone')) field = 'telefone';
    if (!field && err.message?.includes('celular'))  field = 'celular';
    if (!field && err.message?.includes('email'))    field = 'email';

    let message = 'Erro ao atualizar cliente.';
    let status = 500;
    switch (err.code) {
      case '23505':
        status = 409;
        message = field === 'asaas_id'
          ? 'Este ASAAS ID já está vinculado a outro cliente.'
          : 'Já existe um registro com este valor.';
        break;
      case '22001': message = 'Valor muito longo para o campo.'; break;
      case '23502': message = 'Campo obrigatório não informado.'; break;
      default:      message = err.message || message;
    }

    return res.status(status).json({
      status: 'ERROR',
      code: err.code || 'UNKNOWN',
      field,
      message,
      detail: err.detail || null,
      requestId: req.requestId || null
    });
  }
};

export const verificarAsaasUnico = async (req, res) => {
  const { asaasId, excludeId } = req.query;
  const val = (asaasId || '').trim();
  if (!val) return res.json({ status: 'OK', exists: false });

  const { rows } = await pool.query(
    `SELECT 1 FROM clientes
     WHERE asaas_id = $1
       AND ($2::int IS NULL OR cliente_id <> $2::int)
     LIMIT 1`,
    [val, excludeId || null]
  );
  return res.json({ status: 'OK', exists: rows.length > 0 });
};