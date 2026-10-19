import api, {
    create, getById, search, update, remove, addItem, updateItem, removeItem,
    markReady, issueBonusNfe, reconcileBonusNfe, getBonusNfeXml, getBonusNfeDanfe,
} from '../repositories/nfeBonusIssued/nfeBonusIssued.index.js';

const userId = (req) => req.user?.user_id || req.user?.id || null;
const send = (res, result, success = 200) => res.status(result?.ok === false ? (result.error === 'NOT_FOUND' ? 404 : 400) : success).json(result);
const fail = (res, error, code) => res.status(Number(error?.status) || 500).json({ ok: false, error: error?.code || code, message: error?.message || 'Erro interno.', data: error?.details });

export async function searchController(req, res) { try { return send(res, await search(req.query)); } catch (e) { return fail(res, e, 'NFE_BONUS_SEARCH_FAILED'); } }
export async function getController(req, res) { try { return send(res, await getById(req.params.bonusId)); } catch (e) { return fail(res, e, 'NFE_BONUS_GET_FAILED'); } }
export async function createController(req, res) { try { return send(res, await create(req.body, { userId: userId(req) }), 201); } catch (e) { return fail(res, e, 'NFE_BONUS_CREATE_FAILED'); } }
export async function updateController(req, res) { try { return send(res, await update(req.params.bonusId, req.body, { userId: userId(req) })); } catch (e) { return fail(res, e, 'NFE_BONUS_UPDATE_FAILED'); } }
export async function removeController(req, res) { try { return send(res, await remove(req.params.bonusId, { userId: userId(req) })); } catch (e) { return fail(res, e, 'NFE_BONUS_DELETE_FAILED'); } }
export async function addItemController(req, res) { try { return send(res, await addItem(req.params.bonusId, req.body, { userId: userId(req) }), 201); } catch (e) { return fail(res, e, 'NFE_BONUS_ITEM_CREATE_FAILED'); } }
export async function updateItemController(req, res) { try { return send(res, await updateItem(req.params.bonusId, req.params.itemId, req.body, { userId: userId(req) })); } catch (e) { return fail(res, e, 'NFE_BONUS_ITEM_UPDATE_FAILED'); } }
export async function removeItemController(req, res) { try { return send(res, await removeItem(req.params.bonusId, req.params.itemId, { userId: userId(req) })); } catch (e) { return fail(res, e, 'NFE_BONUS_ITEM_DELETE_FAILED'); } }
export async function readyController(req, res) { try { return send(res, await markReady(req.params.bonusId, { userId: userId(req) })); } catch (e) { return fail(res, e, 'NFE_BONUS_READY_FAILED'); } }
export async function issueController(req, res) {
    if (req.body?.confirm !== true) return res.status(400).json({ ok: false, error: 'ISSUE_CONFIRMATION_REQUIRED', message: 'Confirme explicitamente a emissão da NF-e de bonificação.' });
    try { return res.status(202).json({ ok: true, message: 'NF-e de bonificação enviada para processamento.', data: await issueBonusNfe(req.params.bonusId, { userId: userId(req) }) }); } catch (e) { return fail(res, e, 'NFE_BONUS_ISSUE_FAILED'); }
}
export async function statusController(req, res) { try { return res.json({ ok: true, data: await reconcileBonusNfe(req.params.bonusId, { userId: userId(req) }) }); } catch (e) { return fail(res, e, 'NFE_BONUS_RECONCILE_FAILED'); } }
export async function xmlController(req, res) { try { const { xml } = await getBonusNfeXml(req.params.bonusId); res.setHeader('Content-Type', 'application/xml; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="nfe-bonificacao-${Number(req.params.bonusId)}.xml"`); return res.send(xml); } catch (e) { return fail(res, e, 'NFE_BONUS_XML_FAILED'); } }
export async function danfeController(req, res) { try { const { buffer } = await getBonusNfeDanfe(req.params.bonusId); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename="danfe-bonificacao-${Number(req.params.bonusId)}.pdf"`); res.setHeader('Content-Length', String(buffer.length)); return res.end(buffer); } catch (e) { return fail(res, e, 'NFE_BONUS_DANFE_FAILED'); } }

export default { api, searchController, getController, createController, updateController, removeController, addItemController, updateItemController, removeItemController, readyController, issueController, statusController, xmlController, danfeController };
