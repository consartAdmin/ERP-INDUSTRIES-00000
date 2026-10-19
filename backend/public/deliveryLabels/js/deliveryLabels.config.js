// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.config.js — Configuração                     ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

export const API_BASE = '/api/delivery-labels';

export const DELIVERY_LABEL_FIELDS = Object.freeze([
  'delivery_label_id',
  'customer_name',
  'customer_tax_id',
  'phone',
  'order_number',
  'nfe_number',
  'nfe_key',
  'address',
  'number',
  'complement',
  'neighborhood',
  'city',
  'state',
  'zip_code',
  'volumes',
  'weight',
  'delivery_status',
  'driver_name',
  'route_name',
  'notes'
]);

export const DELIVERY_STATUS_LABELS = Object.freeze({
  AGUARDANDO_SEPARACAO: 'Aguardando separação',
  SEPARADO: 'Separado',
  EM_ROTA: 'Em rota',
  ENTREGUE: 'Entregue',
  PROBLEMA_ENTREGA: 'Problema na entrega'
});

export const DEFAULT_STATUS = 'AGUARDANDO_SEPARACAO';
export const DEFAULT_ROWS_PER_PAGE = 20;

// Origens de importação: rota da API e textos da tela
export const IMPORT_SOURCES = Object.freeze({
  order: { endpoint: 'from-order', noun: 'pedido', placeholder: 'Nenhum pedido selecionado' },
  budget: { endpoint: 'from-budget', noun: 'orçamento', placeholder: 'Nenhum orçamento selecionado' },
  invoice: { endpoint: 'from-invoice', noun: 'nota fiscal', placeholder: 'Nenhuma nota fiscal selecionada' }
});
