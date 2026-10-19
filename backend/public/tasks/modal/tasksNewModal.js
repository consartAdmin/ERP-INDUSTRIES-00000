// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tasksNewModal.js — Modal Nova/Editar Tarefa                         ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const MODAL_ID = 'taskModal';
const MOUNT_ID = 'tasksNewModalMount';

export function ensureTasksNewModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  const mount = document.getElementById(MOUNT_ID) || document.body;

  mount.insertAdjacentHTML('beforeend', `
    <dialog id="taskModal" class="task-modal">
      <form id="taskForm" method="dialog">

        <input type="hidden" id="taskId" />

        <div class="modal-header">
          <h2 id="modalTitle">Nova Tarefa</h2>
          <button type="button" id="btnCloseModal" class="modal-close">
            ✕
          </button>
        </div>

        <div class="modal-body">

          <label>
            Título *
            <input type="text" id="taskTitle" required />
          </label>

          <label>
            Descrição
            <textarea id="taskDescription" rows="3"></textarea>
          </label>

          <label>
            Grupo
            <select id="taskGroupId">
              <option value="">Sem grupo</option>
            </select>
          </label>

          <div class="modal-grid">
            <label>
              Status
              <select id="taskStatus">
                <option value="OPEN">OPEN</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="REVIEW">REVIEW</option>
                <option value="FINISHED">FINISHED</option>
              </select>
            </label>

            <label>
              Prioridade
              <select id="taskPriority">
                <option value="LOW">LOW</option>
                <option value="NORMAL" selected>NORMAL</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </label>
          </div>

          <div class="modal-grid">
            <label>
              Responsável
              <input type="number" id="taskAssignedTo" />
            </label>

            <label>
              Criado por
              <input type="number" id="taskCreatedBy" />
            </label>
          </div>

          <div class="modal-grid">
            <label>
              Iniciado em
              <input type="datetime-local" id="taskStartedAt" />
            </label>

            <label>
              Finalizado em
              <input type="datetime-local" id="taskFinishedAt" />
            </label>
          </div>

          <label>
            Observações
            <textarea id="taskObservations" rows="3"></textarea>
          </label>

          <label class="checkbox-line">
            <input type="checkbox" id="taskActive" checked />
            Tarefa ativa
          </label>

        </div>

        <div class="modal-footer">
          <button type="button" id="btnDeleteTask" class="btn btn-danger hidden">
            🗑️ Excluir
          </button>

          <button type="button" id="btnFinishTask" class="btn btn-success hidden">
            ✅ Finalizar
          </button>

          <button type="submit" class="btn btn-primary">
            💾 Salvar
          </button>
        </div>

      </form>
    </dialog>
  `);

  return document.getElementById(MODAL_ID);
}