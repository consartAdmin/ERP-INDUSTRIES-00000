// ╔════════════════════════════════════════════════════════════════════╗
// ║ licitations.sql.js — Montagem do WHERE a partir dos filtros        ║
// ╚════════════════════════════════════════════════════════════════════╝

export function buildFilters(filters = {}) {
    const where = [];
    const values = [];

    const addValue = (value) => {
        values.push(value);
        return `$${values.length}`;
    };

    const {
        search,
        status,
        modality,
        state,
        city,
        agency_name,
        process_number,
        licitation_number,
        participation,
        session_date_from,
        session_date_to,
        proposal_deadline_from,
        proposal_deadline_to,
        product_id,
    } = filters;

    if (search) {
        const p = addValue(`%${String(search).trim()}%`);
        where.push(`(
      process_number ILIKE ${p}
      OR licitation_number ILIKE ${p}
      OR agency_name ILIKE ${p}
      OR product_description ILIKE ${p}
      OR sku ILIKE ${p}
      OR catmat_code ILIKE ${p}
      OR city ILIKE ${p}
    )`);
    }

    if (status) {
        where.push(`status = ${addValue(String(status).trim())}`);
    }

    if (modality) {
        where.push(`modality = ${addValue(String(modality).trim())}`);
    }

    if (state) {
        where.push(`state = ${addValue(String(state).trim().toUpperCase())}`);
    }

    if (city) {
        where.push(`city ILIKE ${addValue(`%${String(city).trim()}%`)}`);
    }

    if (agency_name) {
        where.push(`agency_name ILIKE ${addValue(`%${String(agency_name).trim()}%`)}`);
    }

    if (process_number) {
        where.push(`process_number ILIKE ${addValue(`%${String(process_number).trim()}%`)}`);
    }

    if (licitation_number) {
        where.push(`licitation_number ILIKE ${addValue(`%${String(licitation_number).trim()}%`)}`);
    }

    if (participation !== undefined && participation !== null && participation !== '') {
        const boolValue =
            participation === true ||
            participation === 'true' ||
            participation === '1' ||
            participation === 1;

        where.push(`participation = ${addValue(boolValue)}`);
    }

    if (session_date_from) {
        where.push(`session_date >= ${addValue(session_date_from)}`);
    }

    if (session_date_to) {
        where.push(`session_date <= ${addValue(session_date_to)}`);
    }

    if (proposal_deadline_from) {
        where.push(`proposal_deadline >= ${addValue(proposal_deadline_from)}`);
    }

    if (proposal_deadline_to) {
        where.push(`proposal_deadline <= ${addValue(proposal_deadline_to)}`);
    }

    if (product_id) {
        where.push(`product_id = ${addValue(Number(product_id))}`);
    }

    return {
        clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
        values,
    };
}
