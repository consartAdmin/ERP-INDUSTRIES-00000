// ╔══════════════════════════════════════════════════════════════════════╗
// ║ state.js — CRM Deals (PRODNEX ERP)                                  ║
// ║ Estado central + setters                                             ║
// ║ ✅ Inclui leadSources, dealOutcomes e lossReasons                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  stages: [],
  deals: [],
  sellers: [],
  statusTypes: [],
  leadSources: [],
  dealOutcomes: [],
  lossReasons: [],

  currentSeller: 'all',
  draggedId: null,
};

/* --------------------------------------------------------------------- */
/* SETTERS                                                               */
/* --------------------------------------------------------------------- */

export const setStages = (v) => (state.stages = Array.isArray(v) ? v : []);
export const setDeals = (v) => (state.deals = Array.isArray(v) ? v : []);
export const setSellers = (v) => (state.sellers = Array.isArray(v) ? v : []);
export const setStatusTypes = (v) => (state.statusTypes = Array.isArray(v) ? v : []);
export const setLeadSources = (v) => (state.leadSources = Array.isArray(v) ? v : []);
export const setDealOutcomes = (v) => (state.dealOutcomes = Array.isArray(v) ? v : []);
export const setLossReasons = (v) => (state.lossReasons = Array.isArray(v) ? v : []);

export const setCurrentSeller = (v) => (state.currentSeller = v ?? 'all');
export const setDraggedId = (v) => (state.draggedId = v ?? null);

/* --------------------------------------------------------------------- */
/* GETTERS OPCIONAIS                                                     */
/* --------------------------------------------------------------------- */

export const getStages = () => state.stages;
export const getDeals = () => state.deals;
export const getSellers = () => state.sellers;
export const getStatusTypes = () => state.statusTypes;
export const getLeadSources = () => state.leadSources;
export const getDealOutcomes = () => state.dealOutcomes;
export const getLossReasons = () => state.lossReasons;
export const getCurrentSeller = () => state.currentSeller;
export const getDraggedId = () => state.draggedId;

/* --------------------------------------------------------------------- */
/* HELPERS DE RESET                                                      */
/* --------------------------------------------------------------------- */

export function resetCrmState() {
  state.stages = [];
  state.deals = [];
  state.sellers = [];
  state.statusTypes = [];
  state.leadSources = [];
  state.dealOutcomes = [];
  state.lossReasons = [];
  state.currentSeller = 'all';
  state.draggedId = null;
  return state;
}