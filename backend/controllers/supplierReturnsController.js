// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsController.js — Controller Devolução ao Fornecedor    ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import * as Api from '../repositories/supplierReturns/supplierReturns.index.js';

import { generateDanfeFromXml } from '../services/danfeConsartService.js';

function ok(res, data, status = 200) {
    return res.status(status).json({ success: true, data });
}

function fail(res, err, status = 500) {
    console.error('[supplierReturnsController] error:', err);
    return res.status(status).json({
        success: false,
        message: err?.message || 'Erro interno no módulo de devolução ao fornecedor.',
    });
}

export async function ensure(req, res) {
    try {
        await Api.ensureTables();
        return ok(res, { message: 'Tabelas de devolução ao fornecedor verificadas/criadas.' });
    } catch (err) {
        return fail(res, err);
    }
}

export async function importInboundXml(req, res) {
    try {
        const result = await Api.importInboundXml({
            buffer: req.file?.buffer,
            xmlText: req.body?.xmlText,
            emitUf: req.body?.emitUf || process.env.NFE_UF || 'MG',
        });
        return ok(res, result, 201);
    } catch (err) {
        return fail(res, err, 400);
    }
}

export async function list(req, res) {
    try {
        const result = await Api.list(req.query || {});
        return ok(res, result);
    } catch (err) {
        return fail(res, err);
    }
}

export async function getById(req, res) {
    try {
        const result = await Api.getById(req.params.id);
        if (!result) return fail(res, new Error('Devolução não encontrada.'), 404);
        return ok(res, result);
    } catch (err) {
        return fail(res, err);
    }
}

export async function create(req, res) {
    try {
        const result = await Api.create(req.body || {});
        return ok(res, result, 201);
    } catch (err) {
        return fail(res, err, 400);
    }
}

export async function update(req, res) {
    try {
        const result = await Api.update(req.params.id, req.body || {});
        if (!result) return fail(res, new Error('Devolução não encontrada.'), 404);
        return ok(res, result);
    } catch (err) {
        return fail(res, err, 400);
    }
}

export async function remove(req, res) {
    try {
        const result = await Api.remove(req.params.id);
        if (!result) return fail(res, new Error('Devolução não encontrada.'), 404);
        return ok(res, result);
    } catch (err) {
        return fail(res, err, 400);
    }
}

export async function buildNfeDraft(req, res) {
    try {
        const result = await Api.buildNfeDraft(req.params.id);
        if (!result) return fail(res, new Error('Devolução não encontrada.'), 404);
        return ok(res, result);
    } catch (err) {
        return fail(res, err);
    }
}

export async function emitNfe(req, res) {
    try {
        const result = await Api.emitNfe(req.params.id);

        res.json({
            ok: true,
            data: result,
        });
    } catch (err) {
        console.error('[supplierReturnsController.emitNfe] error:', err);
        res.status(400).json({
            ok: false,
            message: err.message || 'Erro ao emitir NF-e de devolução.',
        });
    }
}

export async function syncPlugNotas(req, res) {
    try {
        const result = await Api.syncPlugNotas(req.params.id);

        return res.json({
            ok: true,
            success: true,
            data: result,
        });
    } catch (err) {
        console.error('[supplierReturnsController.syncPlugNotas] error:', err);

        return res.status(400).json({
            ok: false,
            success: false,
            message: err.message || 'Erro ao sincronizar NF-e com PlugNotas.',
        });
    }
}

export async function downloadXml(req, res) {
    try {
        const result = await Api.downloadXml(req.params.id);

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="devolucao-fornecedor-${req.params.id}.xml"`);

        return res.send(result?.data || result);
    } catch (err) {
        return fail(res, err, 400);
    }
}

export async function downloadPdf(req, res) {
    try {
        const data = await Api.getById(req.params.id);
        if (!data) throw new Error('Devolução não encontrada.');
        if (!data.plugnotas_id) throw new Error('NF-e ainda não possui ID PlugNotas.');

        const xmlResult = await Api.downloadXml(req.params.id);

        let xmlContent =
            xmlResult?.xml ??
            xmlResult?.data ??
            xmlResult?.content ??
            xmlResult;

        if (Buffer.isBuffer(xmlContent)) {
            xmlContent = xmlContent.toString('utf8');
        }

        if (typeof xmlContent !== 'string') {
            xmlContent = JSON.stringify(xmlContent);
        }

        const xmlStart = xmlContent.indexOf('<');
        if (xmlStart >= 0) xmlContent = xmlContent.slice(xmlStart);

        if (!xmlContent.trim().startsWith('<')) {
            throw new Error('XML retornado pelo PlugNotas está vazio ou inválido.');
        }

        const danfeResult = await generateDanfeFromXml({
            numero: data.nfe_number || data.return_id,
            serie: '1',
            chave: data.original_nfe_key,
            xmlContent,
            prot: {
                status: data.status,
                situacao: data.plugnotas_status,
            },
        });

        const pdfBuffer = danfeResult?.buffer || danfeResult;

        if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 1000) {
            throw new Error('DANFE gerado inválido ou vazio.');
        }

        const filename =
            danfeResult?.filename ||
            `danfe-devolucao-${req.params.id}.pdf`;

        res.status(200);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', pdfBuffer.length);
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );
        res.setHeader('Cache-Control', 'no-store');

        return res.end(pdfBuffer);
    } catch (err) {
        return fail(res, err, 400);
    }
}