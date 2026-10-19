// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.validation.js║
// ║ MODULE: Treinamentos de Clientes                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
    return EMAIL_RE.test(String(value || '').trim());
}

// Retorna a primeira mensagem de erro ou null
export function validateTraining(payload) {
    if (!payload.customer_id) return 'Selecione o cliente do treinamento.';
    if (!payload.title) return 'Informe o título do treinamento.';
    if (!payload.scheduled_at) return 'Informe a data e o horário do treinamento.';

    const invalid = payload.attendees.find((a) => a.email && !isValidEmail(a.email));
    if (invalid) return `E-mail inválido do participante "${invalid.name || invalid.email}".`;

    return null;
}

export function validateEmailRecipients(list) {
    if (!list.length) return 'Informe ao menos um destinatário.';
    const invalid = list.find((e) => !isValidEmail(e));
    return invalid ? `E-mail inválido: ${invalid}` : null;
}
