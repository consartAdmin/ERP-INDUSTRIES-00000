// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.init.js — Inicialização do módulo            ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { initializeDeliveryLabels } from './deliveryLabels.actions.js';

async function bootstrap() {
  try {
    await initializeDeliveryLabels();
  } catch (error) {
    console.error('[deliveryLabels] Falha ao inicializar:', error);
    window.alert(`Erro ao inicializar etiquetas de entrega: ${error.message}`);
  }
}

void bootstrap();
