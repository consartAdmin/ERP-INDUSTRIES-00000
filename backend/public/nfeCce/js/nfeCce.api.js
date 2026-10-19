/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: nfeCce.api.js                                                ║
   ║ MODULE: NF-e | Carta de Correção Eletrônica (CC-e)                 ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { ROUTES } from './nfeCce.config.js';

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error?.message ||
            data?.error ||
            (typeof data === 'string' ? data : null) ||
            `Erro HTTP ${response.status}`;
        throw new Error(message);
    }

    return data;
}

export function emitirCce(payload) {
    return fetchJson(ROUTES.emitir, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function consultarStatus(identificador, listaCce = false) {
    const url = new URL(ROUTES.status(identificador));
    if (listaCce) url.searchParams.set('listaCce', 'true');
    return fetchJson(url.toString());
}

export function buscarHistorico({
    nfeNumber,
    nfeKey,
    idOuChave,
}) {
    if (idOuChave) {
        return fetchJson(ROUTES.historicoPorNfe(idOuChave));
    }

    const url = new URL(ROUTES.historico);

    if (nfeNumber) {
        url.searchParams.set('nfeNumber', nfeNumber);
    }

    if (nfeKey) {
        url.searchParams.set('nfeKey', nfeKey);
    }

    return fetchJson(url.toString());
}

function normalizeInvoicesIssuedPayload(data) {
    const candidates = [
        data?.data?.rows,
        data?.data?.items,
        data?.data?.invoices,
        data?.data,
        data?.rows,
        data?.items,
        data?.invoices,
        data,
    ];

    const rows = candidates.find(Array.isArray) || [];
    return rows;
}

export async function listarNfesEmitidas(search = '') {
    let lastError = null;

    for (const baseUrl of ROUTES.invoicesIssuedCandidates || []) {
        try {
            const url = new URL(baseUrl);
            url.searchParams.set('limit', '100');
            if (search) url.searchParams.set('search', search);

            const data = await fetchJson(url.toString());
            return normalizeInvoicesIssuedPayload(data);
        } catch (error) {
            lastError = error;

            // Se o alias não existe, tenta o próximo. Para outros erros,
            // também preservamos a última mensagem para diagnóstico.
            continue;
        }
    }

    throw lastError || new Error('Não foi possível consultar as NF-e emitidas.');
}
