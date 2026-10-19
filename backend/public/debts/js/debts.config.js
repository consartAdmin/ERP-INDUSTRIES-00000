// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: debts.dom.js                                                  ║
// ║ MODULE: Debt Control Frontend                                       ║
// ║ DESCRIPTION: Centralized DOM references                             ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const els = {};

export function refreshDom() {
  els.filtersForm = document.getElementById('filtersForm');

  els.q = document.getElementById('q');
  els.status = document.getElementById('status');
  els.debt_type = document.getElementById('debt_type');
  els.creditor_name = document.getElementById('creditor_name');
  els.due_date_from = document.getElementById('due_date_from');
  els.due_date_to = document.getElementById('due_date_to');
  els.only_overdue = document.getElementById('only_overdue');
  els.only_open = document.getElementById('only_open');

  els.btnClearFilters = document.getElementById('btnClearFilters');
  els.btnReload = document.getElementById('btnReload');
  els.btnNewDebt = document.getElementById('btnNewDebt');

  els.pageSize = document.getElementById('pageSize');

  /* IDs currently used in the HTML */
  els.btnPrevPage = document.getElementById('btnPrevious');
  els.btnNextPage = document.getElementById('btnNext');

  els.pageInfo = document.getElementById('pageInfo');
  els.apTableInfo = document.getElementById('apTableInfo');
  els.tableBody = document.getElementById('tableBody');

  els.sumTotalOpen = document.getElementById('sumTotalOpen');
  els.sumTotalOverdue = document.getElementById('sumTotalOverdue');
  els.sumDueToday = document.getElementById('sumDueToday');
  els.sumTotalPaid = document.getElementById('sumTotalPaid');

  els.debtModal = document.getElementById('debtModal');
  els.debtModalTitle = document.getElementById('debtModalTitle');
  els.debtForm = document.getElementById('debtForm');
  els.debt_id = document.getElementById('debt_id');

  els.code = document.getElementById('code');
  els.description = document.getElementById('description');
  els.debt_type_form = document.getElementById('debt_type_form');
  els.creditor_name_form = document.getElementById('creditor_name_form');
  els.creditor_document = document.getElementById('creditor_document');
  els.company_name = document.getElementById('company_name');
  els.category = document.getElementById('category');
  els.cost_center = document.getElementById('cost_center');
  els.document_number = document.getElementById('document_number');
  els.reference_number = document.getElementById('reference_number');
  els.issue_date = document.getElementById('issue_date');

  els.agreement_closed_at = document.getElementById('agreement_closed_at');
  els.first_installment_due_at = document.getElementById('first_installment_due_at');

  els.installment_total = document.getElementById('installment_total');
  els.due_day_mode = document.getElementById('due_day_mode');
  els.due_day = document.getElementById('due_day');
  els.due_day_manual_box = document.getElementById('due_day_manual_box');

  els.original_amount = document.getElementById('original_amount');
  els.interest_amount = document.getElementById('interest_amount');
  els.fine_amount = document.getElementById('fine_amount');
  els.discount_amount = document.getElementById('discount_amount');
  els.updated_amount_preview = document.getElementById('updated_amount_preview');
  els.notes = document.getElementById('notes');

  els.plan_start_installment = document.getElementById('plan_start_installment');
  els.plan_end_installment = document.getElementById('plan_end_installment');
  els.plan_installment_amount = document.getElementById('plan_installment_amount');
  els.btnAddInstallmentPlan = document.getElementById('btnAddInstallmentPlan');
  els.installmentPlansTableBody = document.getElementById('installmentPlansTableBody');

  els.paymentModal = document.getElementById('paymentModal');
  els.paymentModalSubtitle = document.getElementById('paymentModalSubtitle');
  els.paymentForm = document.getElementById('paymentForm');
  els.payment_debt_id = document.getElementById('payment_debt_id');
  els.payment_installment = document.getElementById('payment_installment');
  els.payment_date = document.getElementById('payment_date');
  els.payment_amount = document.getElementById('payment_amount');
  els.payment_interest = document.getElementById('payment_interest');
  els.payment_fine = document.getElementById('payment_fine');
  els.payment_discount = document.getElementById('payment_discount');
  els.payment_method = document.getElementById('payment_method');
  els.receipt_number = document.getElementById('receipt_number');
  els.payment_notes = document.getElementById('payment_notes');
  els.paymentsTableBody = document.getElementById('paymentsTableBody');
  els.paymentSummaryBox = document.getElementById('paymentSummaryBox');

  els.toast = document.getElementById('toast');
}