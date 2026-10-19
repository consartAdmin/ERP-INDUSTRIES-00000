import * as api from '../repositories/nfeOperationTypes/nfeOperationTypes.index.js';

function status(result) {
    if (result?.ok) return 200;
    if (result?.error === 'NOT_FOUND') return 404;
    return 400;
}

export async function search(req, res) {
    try { return res.json(await api.search(req.query)); }
    catch (error) { return res.status(500).json({ ok: false, error: error.code || 'NFE_OPERATION_TYPES_SEARCH_FAILED', message: error.message }); }
}
export async function getById(req, res) {
    try { const result = await api.getById(req.params.operationTypeId); return res.status(status(result)).json(result); }
    catch (error) { return res.status(500).json({ ok: false, error: error.code || 'NFE_OPERATION_TYPE_GET_FAILED', message: error.message }); }
}
export async function create(req, res) {
    try { const result = await api.create(req.body); return res.status(result.ok ? 201 : 400).json(result); }
    catch (error) { return res.status(500).json({ ok: false, error: error.code || 'NFE_OPERATION_TYPE_CREATE_FAILED', message: error.message }); }
}
export async function update(req, res) {
    try { const result = await api.update(req.params.operationTypeId, req.body); return res.status(status(result)).json(result); }
    catch (error) { return res.status(500).json({ ok: false, error: error.code || 'NFE_OPERATION_TYPE_UPDATE_FAILED', message: error.message }); }
}

export async function remove(req, res) {
    try {
        const result = await api.remove(req.params.operationTypeId);
        const httpStatus = result.ok ? 200 : result.error === 'NOT_FOUND' ? 404 : result.error === 'OPERATION_TYPE_IN_USE' ? 409 : 400;
        return res.status(httpStatus).json(result);
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.code || 'NFE_OPERATION_TYPE_DELETE_FAILED', message: error.message });
    }
}

export default { search, getById, create, update, remove };
