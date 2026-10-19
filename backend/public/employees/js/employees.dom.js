// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.dom.js — Map de elementos DOM (PRODNEX ERP | ESM)                  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { qs } from './employees.utils.js';

export const el = {
  // tabs
  tabEmployeesList: qs('#tabEmployeesList'),
  tabEmployeesDetails: qs('#tabEmployeesDetails'),
  btnBackToList: qs('#btnBackToList'),

  // left list
  employeesSearch: qs('#employeesSearch'),
  btnSearchEmployees: qs('#btnSearchEmployees'),
  employeesShowInactive: qs('#employeesShowInactive'),
  btnNewEmployee: qs('#btnNewEmployee'),
  employeesTableBody: qs('#employeesTableBody'),

  // footer / paginação
  empTableInfo: qs('#empTableInfo'),
  empPageInfo: qs('#empPageInfo'),
  btnPreviousPage: qs('#btnPreviousPage'),
  btnNextPage: qs('#btnNextPage'),
  empRowsPerPage: qs('#empRowsPerPage'),

  // selection
  btnClearSelection: qs('#btnClearSelection'),
  selectedEmployeeHint: qs('#selectedEmployeeHint'),

  // form fields
  form: qs('#employeeForm'),
  employee_id: qs('#employee_id'),
  full_name: qs('#full_name'),
  cpf: qs('#cpf'),
  rg: qs('#rg'),
  admission_date: qs('#admission_date'),
  department: qs('#department'),
  position: qs('#position'),
  email: qs('#email'),
  phone: qs('#phone'),
  mobile: qs('#mobile'),
  active: qs('#active'),

  // advanced
  advDetails: qs('#advDetails'),
  trial_start_date: qs('#trial_start_date'),
  trial_end_date: qs('#trial_end_date'),
  trial_extended: qs('#trial_extended'),
  trial_extension_end_date: qs('#trial_extension_end_date'),
  trial_notes: qs('#trial_notes'),
  transport_benefit: qs('#transport_benefit'),
  food_benefit: qs('#food_benefit'),
  meal_benefit: qs('#meal_benefit'),
  health_benefit: qs('#health_benefit'),
  address: qs('#address'),
  city: qs('#city'),
  state: qs('#state'),
  postal_code: qs('#postal_code'),
  notes: qs('#notes'),

  // actions
  btnCancelEdit: qs('#btnCancelEdit'),
  btnInactivateEmployee: qs('#btnInactivateEmployee'),
  btnHardDeleteEmployee: qs('#btnHardDeleteEmployee'),

  // docs
  btnReloadDocs: qs('#btnReloadDocs'),
  docsSummary: qs('#docsSummary'),
  docsTableBody: qs('#docsTableBody'),

  docForm: qs('#docForm'),
  employee_document_id: qs('#employee_document_id'),
  document_type: qs('#document_type'),
  file_name: qs('#file_name'),
  doc_notes: qs('#doc_notes'),
  file_pick: qs('#file_pick'),
  filePickLabel: qs('#filePickLabel'),
  btnAddDoc: qs('#btnAddDoc'),
  btnClearDocForm: qs('#btnClearDocForm'),
};