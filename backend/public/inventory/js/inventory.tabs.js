// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.tabs.js — Tabs                                              ║
// ║ PRODNEX ERP | Inventário                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function activateTab(els, name) {
  const btnMap = { list: els.tabListBtn, edit: els.tabEditBtn, logs: els.tabLogsBtn };
  const panelMap = { list: els.tabListPanel, edit: els.tabEditPanel, logs: els.tabLogsPanel };

  Object.entries(btnMap).forEach(([key, btn]) => btn?.classList.toggle('is-active', key === name));
  Object.entries(panelMap).forEach(([key, panel]) => panel?.classList.toggle('is-active', key === name));
}