// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ core.js — Script principal PRODNEX ERP (importador global de módulos)    ║
// ║ Responsável por carregar scripts base de navegação, segurança e sessão.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// === VERIFICA LOGIN (autenticação obrigatória) ===
import '/public/includes/js/auth.js';

// === MENU DE NAVEGAÇÃO ===
import '/public/includes/js/menuConsart.js';

// === MENU DE NAVEGAÇÃO ===
import '/public/includes/js/apiBase.js';

// === SEGURANÇA E PERMISSÕES DE MÓDULOS ===
import '/public/includes/js/securityModules.js';

// === GERENCIAMENTO DE TIMEOUT DE SESSÃO ===
import '/public/includes/js/sessionTimeOutConfig.js';

import '/public/includes/js/statusUsuario.js';

import '/public/includes/js/topGradientBar.js';

import '/public/includes/js/date-range-field.js';

import '/public/includes/js/modal.js';

import '/public/includes/js/sortableTable.js';

// === ENGRENAGEM ⚙️ DAS TABELAS (linhas, largura/altura, colunas) ===
import '/public/includes/js/tableSettings.js';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// (opcional, mas recomendado) helper padronizado:
window.Alert = {
  info: (title, message, ms = 3800) =>
    showCenterModal({ variant: 'info', title, message, timeoutMs: ms }),
  success: (title, message, ms = 4200) =>
    showCenterModal({ variant: 'success', title, message, timeoutMs: ms }),
  warn: (title, message) =>
    showCenterModal({ variant: 'warning', title, message }),
  error: (title, message) =>
    showCenterModal({ variant: 'error', title, message }),
};

// (Opcional) Adicione aqui outros módulos globais do ERP
// import '/public/includes/js/themeSwitcher.js';
// import '/public/includes/js/notificacoes.js';
