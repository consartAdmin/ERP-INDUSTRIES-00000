export const SUPPLIERS_API = '/api/suppliers';
// Senha para abrir a edição de fornecedores. Defina como true para reativar.
export const EDIT_SUPPLIER_PASSWORD_ENABLED = false;
export const EDIT_SUPPLIER_PASSWORD = '123456';
export const DEFAULT_PAGE_SIZE = 50;
export const SORTABLE_COLUMNS = ['supplier_id', 'name', 'tax_id', 'city', 'state', 'phone', 'email'];
export const attachmentsUrl = (supplierId) => `${SUPPLIERS_API}/${supplierId}/attachments`;
