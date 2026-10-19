// ╔══════════════════════════════════════════════════════════════════════╗
// ║ balancoPatrimonialController.js — Handlers REST                     ║
/* ╚══════════════════════════════════════════════════════════════════════╝ */

import * as API from '../repositories/balancoPatrimonial/balancoPatrimonial.index.js';

export const balancoPatrimonialController = {
  async list(req, res) {
    try {
      const { q, categoria, dt_from, dt_to, limit, offset, orderBy } = req.query;
      const out = await API.list({ q, categoria, dt_from, dt_to, limit, offset, orderBy });
      res.json({ ok: true, ...out });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: 'Erro ao listar' });
    }
  },

  async get(req, res) {
    try {
      const id = Number(req.params.id);
      const data = await API.getById(id);
      if (!data) return res.status(404).json({ ok:false, error: 'Registro não encontrado' });
      res.json({ ok:true, data });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok:false, error: 'Erro ao buscar' });
    }
  },

  async create(req, res) {
    try {
      const data = await API.create(req.body || {});
      res.status(201).json({ ok:true, data });
    } catch (e) {
      console.error(e);
      res.status(400).json({ ok:false, error: e.message || 'Erro ao criar' });
    }
  },

  async update(req, res) {
    try {
      const id = Number(req.params.id);
      const data = await API.update(id, req.body || {});
      res.json({ ok:true, data });
    } catch (e) {
      console.error(e);
      res.status(400).json({ ok:false, error: e.message || 'Erro ao atualizar' });
    }
  },

  async remove(req, res) {
    try {
      const id = Number(req.params.id);
      await API.remove(id);
      res.json({ ok:true });
    } catch (e) {
      console.error(e);
      res.status(400).json({ ok:false, error: 'Erro ao remover' });
    }
  }
};
