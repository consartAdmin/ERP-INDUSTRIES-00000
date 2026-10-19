// ╔════════════════════════════════════════════════════════════════════╗
// ║ tasks.index.js — ponto de entrada do módulo tasks                  ║
// ║ Mantém a mesma API pública do antigo tasksApi.js                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ensureTasksGroupColumn } from './tasksSchema.repository.js';
import { listTasks, getTaskById } from './tasksQuery.repository.js';
import { createTask } from './tasksCreate.repository.js';
import { updateTask, finishTask } from './tasksUpdate.repository.js';
import { deleteTask } from './tasksRemove.repository.js';

export {
  ensureTasksGroupColumn,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  finishTask,
  deleteTask,
};

export default {
  ensureTasksGroupColumn,
  listTasks,
  getTaskById,
  createTask,
  updateTask,
  finishTask,
  deleteTask,
};
