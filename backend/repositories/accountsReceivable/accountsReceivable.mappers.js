// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.mappers.js — Status Asaas → status do ERP       ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapStatusFromAsaas(asaasStatus) {
  switch (asaasStatus) {
    case 'PENDING': return 'PENDING';
    case 'RECEIVED': return 'PAID';
    case 'OVERDUE': return 'OVERDUE';
    case 'CONFIRMED': return 'PAID';
    case 'REFUNDED': return 'CANCELLED';
    case 'CANCELLED': return 'CANCELLED';
    default: return asaasStatus || 'UNKNOWN';
  }
}
