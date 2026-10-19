// ╔══════════════════════════════════════════════════════════════╗
// ║ FILE: tasksController.js                                    ║
// ║ MODULE: Tasks Controller                                    ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import {
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  finishTask,
  deleteTask,
} from '../repositories/tasks/tasks.index.js';

export async function list(req, res) {
  try {
    const tasks = await listTasks(req.query);
    return res.json({ ok: true, data: tasks });
  } catch (error) {
    console.error('[tasksController] list error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export async function getById(req, res) {
  try {
    const task = await getTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ ok: false, error: 'Task not found' });
    }

    return res.json({ ok: true, data: task });
  } catch (error) {
    console.error('[tasksController] getById error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export async function create(req, res) {
  try {
    if (!req.body.title) {
      return res.status(400).json({
        ok: false,
        error: 'Title is required',
      });
    }

    const task = await createTask(req.body);
    return res.status(201).json({ ok: true, data: task });
  } catch (error) {
    console.error('[tasksController] create error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export async function update(req, res) {
  try {
    const task = await updateTask(req.params.id, req.body);

    if (!task) {
      return res.status(404).json({ ok: false, error: 'Task not found' });
    }

    return res.json({ ok: true, data: task });
  } catch (error) {
    console.error('[tasksController] update error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export async function finish(req, res) {
  try {
    const task = await finishTask(req.params.id);

    if (!task) {
      return res.status(404).json({ ok: false, error: 'Task not found' });
    }

    return res.json({ ok: true, data: task });
  } catch (error) {
    console.error('[tasksController] finish error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}

export async function remove(req, res) {
  try {
    const deleted = await deleteTask(req.params.id);

    if (!deleted) {
      return res.status(404).json({ ok: false, error: 'Task not found' });
    }

    return res.json({ ok: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[tasksController] remove error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}