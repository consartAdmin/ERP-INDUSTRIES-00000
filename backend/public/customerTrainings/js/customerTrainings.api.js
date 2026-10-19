// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/customerTrainings/js/customerTrainings.api.js  ║
// ║ MODULE: Treinamentos de Clientes                                    ║
// ║ 🔐 apiFetch envia o JWT (rotas usam requireAuth)                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { apiFetch, getAuthToken } from '/public/includes/js/apiFetch.js';
import { API } from './customerTrainings.config.js';

async function apiGet(url) {
    const json = await apiFetch(url);
    if (json?.ok === false) throw new Error(json.error || 'Erro na API.');
    return json;
}

async function apiSend(url, method, body) {
    const json = await apiFetch(url, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (json?.ok === false) throw new Error(json.error || 'Erro na API.');
    return json;
}

const trainingUrl = (id) => `${API}/${encodeURIComponent(id)}`;

export function fetchTrainings(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value != null) params.set(key, String(value));
    });
    return apiGet(`${API}?${params}`);
}

export async function fetchTraining(id) {
    return (await apiGet(trainingUrl(id))).row;
}

export async function createTraining(data) {
    return (await apiSend(API, 'POST', data)).row;
}

export async function updateTraining(id, data) {
    return (await apiSend(trainingUrl(id), 'PUT', data)).row;
}

export async function completeTraining(id, data) {
    return (await apiSend(`${trainingUrl(id)}/complete`, 'POST', data)).row;
}

export function deleteTraining(id) {
    return apiSend(trainingUrl(id), 'DELETE');
}

export function sendTrainingEmail(id, data) {
    return apiSend(`${trainingUrl(id)}/email`, 'POST', data);
}

// PDF precisa do JWT no header → baixa como blob e abre em nova aba.
// A aba é aberta antes do fetch (ainda dentro do clique) para não ser bloqueada.
export async function openTrainingPdf(id) {
    const win = window.open('', '_blank');
    const token = getAuthToken();

    try {
        const res = await fetch(`${trainingUrl(id)}/pdf`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error || `HTTP ${res.status}`);
        }

        const url = URL.createObjectURL(await res.blob());
        if (win) win.location.href = url;
        else window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
        win?.close();
        throw error;
    }
}

// Cadastro do cliente (para pré-preencher participante com o contato)
export async function fetchCustomer(customerId) {
    const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
