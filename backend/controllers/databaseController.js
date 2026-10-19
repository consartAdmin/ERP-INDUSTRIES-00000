// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/controllers/databaseController.js                     ║
// ║ MODULE: Database Viewer / Editor                                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  listTables,
  getTableColumns,
  getTableRows,
  insertRow,
  updateRow,
  deleteRow,
  getTableStructure,
  previewStructureChange,
  applyStructureChange,
} from '../repositories/database/database.index.js';

function ok(res, data) {
  return res.json({
    success: true,
    data,
  });
}

function fail(res, err) {
  console.error('[databaseController]', err);

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno no módulo de banco de dados.',
  });
}

export async function listDatabaseTables(req, res) {
  try {
    const data = await listTables({
      schema: req.query.schema || 'public',
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function getDatabaseTableColumns(req, res) {
  try {
    const data = await getTableColumns({
      schema: req.query.schema || 'public',
      table: req.params.table,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function getDatabaseTableRows(req, res) {
  try {
    const data = await getTableRows({
      schema: req.query.schema || 'public',
      table: req.params.table,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || '',
      orderBy: req.query.orderBy || '',
      orderDir: req.query.orderDir || 'ASC',
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function createDatabaseRow(req, res) {
  try {
    const data = await insertRow({
      schema: req.query.schema || 'public',
      table: req.params.table,
      data: req.body?.data || req.body || {},
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function updateDatabaseRow(req, res) {
  try {
    const data = await updateRow({
      schema: req.query.schema || 'public',
      table: req.params.table,
      pk: req.body?.pk,
      data: req.body?.data,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function deleteDatabaseRow(req, res) {
  try {
    const data = await deleteRow({
      schema: req.query.schema || 'public',
      table: req.params.table,
      pk: req.body?.pk,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function getDatabaseTableStructure(req, res) {
  try {
    const data = await getTableStructure({
      schema: req.query.schema || 'public',
      table: req.params.table,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function previewDatabaseStructureChange(req, res) {
  try {
    const data = await previewStructureChange({
      schema: req.query.schema || 'public',
      table: req.params.table,
      operation: req.body?.operation,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

export async function applyDatabaseStructureChange(req, res) {
  try {
    const data = await applyStructureChange({
      schema: req.query.schema || 'public',
      table: req.params.table,
      operation: req.body?.operation,
      userId: req.user?.user_id ?? null,
    });

    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}
