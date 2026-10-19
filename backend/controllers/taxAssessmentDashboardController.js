// ╔══════════════════════════════════════════════════════════════════════╗
// ║ taxAssessmentDashboardController.js — Apuração (débito × crédito)   ║
// ║ CONSART ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { loadTaxAssessment } from '../repositories/taxAssessment/taxAssessment.repository.js';
import {
    buildAssessmentXlsx,
    buildAssessmentPdf,
    exportFileName,
} from '../repositories/taxAssessment/taxAssessment.export.js';


const EXPORT_FORMATS = Object.freeze({
    xlsx: {
        build: buildAssessmentXlsx,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    pdf: {
        build: buildAssessmentPdf,
        contentType: 'application/pdf',
    },
});


function readPeriod(req) {
    return {
        startDate: String(req.query?.startDate || '').trim(),
        endDate: String(req.query?.endDate || '').trim(),
    };
}


export async function getTaxAssessmentDashboard(req, res) {
    try {
        const data = await loadTaxAssessment(readPeriod(req));

        return res.json({
            ok: true,
            ...data,
        });
    } catch (error) {
        console.error('[taxAssessmentDashboardController] getTaxAssessmentDashboard:', error);

        return res.status(Number(error?.status) || 500).json({
            ok: false,
            code: error?.code || 'TAX_ASSESSMENT_ERROR',
            message: error?.message || 'Unable to load tax assessment dashboard.',
        });
    }
}


export async function exportTaxAssessment(req, res) {
    const format = EXPORT_FORMATS[String(req.query?.format || '').toLowerCase()];

    if (!format) {
        return res.status(400).json({
            ok: false,
            code: 'INVALID_FORMAT',
            message: 'Formato inválido. Use xlsx ou pdf.',
        });
    }

    try {
        const data = await loadTaxAssessment(readPeriod(req));
        const buffer = await format.build(data);
        const extension = format === EXPORT_FORMATS.pdf ? 'pdf' : 'xlsx';

        res.setHeader('Content-Type', format.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportFileName(data, extension)}"`);
        res.setHeader('Cache-Control', 'no-store');

        return res.send(buffer);
    } catch (error) {
        console.error('[taxAssessmentDashboardController] exportTaxAssessment:', error);

        return res.status(Number(error?.status) || 500).json({
            ok: false,
            code: error?.code || 'TAX_ASSESSMENT_EXPORT_ERROR',
            message: error?.message || 'Unable to export tax assessment.',
        });
    }
}
