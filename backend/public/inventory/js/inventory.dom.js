// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.dom.js — DOM refs (NULL SAFE) — PRODNEX ERP              ║
// ║ Path: /public/inventory/js/inventory.dom.js                         ║
// ║ ✅ Exporta getEls() (named export)                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

/**
 * Returns all DOM elements used by the inventory module.
 *
 * NULL SAFE:
 * Missing optional elements return null and are handled with
 * optional chaining in the other modules.
 *
 * Always call getEls() after DOMContentLoaded or inside init().
 */
export function getEls() {
  return {
    /* ──────────────────────────────────────────────────────────
       INVENTORY LIST
    ────────────────────────────────────────────────────────── */

    inventoryTableBody:
      document.getElementById('inventoryTableBody'),

    searchInventory:
      document.getElementById('searchInventory'),

    statusFilter:
      document.getElementById('statusFilter'),

    btnSearchInventories:
      document.getElementById('btnSearchInventories'),

    btnRefreshInventories:
      document.getElementById('btnRefreshInventories'),

    btnNewInventory:
      document.getElementById('btnNewInventory'),

    /* ──────────────────────────────────────────────────────────
       IMPORT XLS / DOWNLOAD TEMPLATE
    ────────────────────────────────────────────────────────── */

    btnImportXls:
      document.getElementById('btnImportInventoryXls') ||
      document.getElementById('btnImportXls') ||
      document.getElementById('btnImportXLS'),

    inputImportXls:
      document.getElementById('inputImportInventoryXls'),

    btnDownloadInventoryTemplate:
      document.getElementById(
        'btnDownloadInventoryTemplate'
      ),

    /* ──────────────────────────────────────────────────────────
       INVENTORY HEADER / FORM
    ────────────────────────────────────────────────────────── */

    inventoryForm:
      document.getElementById('inventoryForm'),

    inventoryCode:
      document.getElementById('inventoryCode'),

    inventoryType:
      document.getElementById('inventoryType'),

    inventoryStatus:
      document.getElementById('inventoryStatus'),

    referenceDate:
      document.getElementById('referenceDate'),

    inventoryNotes:
      document.getElementById('inventoryNotes'),

    btnOpenInventoryNotes:
      document.getElementById('btnOpenInventoryNotes'),

    /* Original/fallback buttons */

    btnSaveInventory:
      document.getElementById('btnSaveInventory'),

    btnFinalizeInventory:
      document.getElementById('btnFinalizeInventory'),

    /* Visible inline buttons */

    btnSaveInventoryInline:
      document.getElementById('btnSaveInventoryInline'),

    btnFinalizeInventoryInline:
      document.getElementById(
        'btnFinalizeInventoryInline'
      ),

    /* ──────────────────────────────────────────────────────────
       INVENTORY ITEMS
    ────────────────────────────────────────────────────────── */

    itemsTbody:
      document.getElementById(
        'inventoryItemsTableBody'
      ),

    itemProductNameEl:
      document.getElementById('itemProductName'),

    itemProductCode:
      document.getElementById('itemProductCode'),

    itemProductCodeValue:
      document.getElementById(
        'itemProductCodeValue'
      ),

    itemUnit:
      document.getElementById('itemUnit'),

    itemLocation:
      document.getElementById('itemLocation'),

    itemLocationValue:
      document.getElementById(
        'itemLocationValue'
      ),

    itemCountedQty:
      document.getElementById('itemCountedQty'),

    itemNotes:
      document.getElementById('itemNotes'),

    btnSearchProduct:
      document.getElementById('btnSearchProduct'),

    btnSaveItem:
      document.getElementById('btnSaveItem'),

    /* ──────────────────────────────────────────────────────────
       PRODUCT LOTS
    ────────────────────────────────────────────────────────── */

    lotSelect:
      document.getElementById('lotSelect'),

    lotHint:
      document.getElementById('lotHint'),

    /* ──────────────────────────────────────────────────────────
       TABS
    ────────────────────────────────────────────────────────── */

    tabListBtn:
      document.getElementById('tabListBtn'),

    tabEditBtn:
      document.getElementById('tabEditBtn'),

    tabLogsBtn:
      document.getElementById('tabLogsBtn'),

    tabListPanel:
      document.getElementById('tab-list'),

    tabEditPanel:
      document.getElementById('tab-edit'),

    tabLogsPanel:
      document.getElementById('tab-logs'),

    /* ──────────────────────────────────────────────────────────
       AUDIT LOGS
    ────────────────────────────────────────────────────────── */

    logDateFrom:
      document.getElementById('logDateFrom'),

    logDateTo:
      document.getElementById('logDateTo'),

    logUserName:
      document.getElementById('logUserName'),

    logProductCode:
      document.getElementById('logProductCode'),

    btnSearchLogs:
      document.getElementById('btnSearchLogs'),

    logsTbody:
      document.getElementById(
        'inventoryLogsTableBody'
      ),
  };
}