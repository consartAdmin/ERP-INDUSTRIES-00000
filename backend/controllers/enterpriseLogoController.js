// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseLogoController.js — Logo de Empresas                     ║
// ║ CONSART ERP | Controller | ESM                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';
import {
    deleteEnterpriseLogoByUrl,
    deleteEnterpriseLogoObject,
    uploadEnterpriseLogoToBucket,
} from '../uploadBuckets/uploadBucketsEnterprise.js';

function toEnterpriseId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function findEnterpriseLogo(enterpriseId) {
    const { rows } = await pool.query(
        `
      SELECT id, logo_url
      FROM public.enterprises
      WHERE id = $1
      LIMIT 1
    `,
        [enterpriseId],
    );

    return rows[0] || null;
}

export async function uploadEnterpriseLogo(req, res) {
    const enterpriseId = toEnterpriseId(req.params.id);

    if (!enterpriseId) {
        return res.status(400).json({
            ok: false,
            error: 'ID da empresa inválido.',
        });
    }

    if (!req.file?.buffer) {
        return res.status(400).json({
            ok: false,
            error: 'Arquivo da logo não informado.',
        });
    }

    let uploaded = null;

    try {
        const enterprise = await findEnterpriseLogo(enterpriseId);

        if (!enterprise) {
            return res.status(404).json({
                ok: false,
                error: 'Empresa não encontrada.',
            });
        }

        uploaded = await uploadEnterpriseLogoToBucket({
            enterpriseId,
            buffer: req.file.buffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
        });

        const { rows } = await pool.query(
            `
        UPDATE public.enterprises
        SET logo_url = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, logo_url
      `,
            [uploaded.publicUrl, enterpriseId],
        );

        if (!rows[0]) {
            await deleteEnterpriseLogoObject(uploaded.objectPath, {
                ignoreNotFound: true,
            }).catch(() => { });

            return res.status(404).json({
                ok: false,
                error: 'Empresa não encontrada.',
            });
        }

        if (enterprise.logo_url && enterprise.logo_url !== uploaded.publicUrl) {
            await deleteEnterpriseLogoByUrl(enterprise.logo_url, {
                ignoreNotFound: true,
                silent: true,
            });
        }

        return res.status(200).json({
            ok: true,
            data: {
                enterprise_id: rows[0].id,
                logo_url: rows[0].logo_url,
                logo_path: uploaded.objectPath,
                bucket: uploaded.bucket,
            },
        });
    } catch (error) {
        console.error('[enterpriseLogoController.uploadEnterpriseLogo]', error);

        if (uploaded?.objectPath) {
            await deleteEnterpriseLogoObject(uploaded.objectPath, {
                ignoreNotFound: true,
            }).catch(() => { });
        }

        const status =
            error?.code === 'INVALID_ENTERPRISE_LOGO_TYPE' ? 415 :
                error?.code === 'ENTERPRISE_LOGO_FILE_REQUIRED' ? 400 :
                    error?.code === 'INVALID_ENTERPRISE_ID' ? 400 :
                        500;

        return res.status(status).json({
            ok: false,
            error: error?.message || 'Erro interno ao enviar logo da empresa.',
        });
    }
}

export async function deleteEnterpriseLogo(req, res) {
    const enterpriseId = toEnterpriseId(req.params.id);

    if (!enterpriseId) {
        return res.status(400).json({
            ok: false,
            error: 'ID da empresa inválido.',
        });
    }

    try {
        const enterprise = await findEnterpriseLogo(enterpriseId);

        if (!enterprise) {
            return res.status(404).json({
                ok: false,
                error: 'Empresa não encontrada.',
            });
        }

        const { rowCount } = await pool.query(
            `
        UPDATE public.enterprises
        SET logo_url = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
            [enterpriseId],
        );

        if (!rowCount) {
            return res.status(404).json({
                ok: false,
                error: 'Empresa não encontrada.',
            });
        }

        if (enterprise.logo_url) {
            await deleteEnterpriseLogoByUrl(enterprise.logo_url, {
                ignoreNotFound: true,
                silent: true,
            });
        }

        return res.status(200).json({
            ok: true,
            data: {
                enterprise_id: enterpriseId,
                logo_url: null,
            },
        });
    } catch (error) {
        console.error('[enterpriseLogoController.deleteEnterpriseLogo]', error);

        return res.status(500).json({
            ok: false,
            error: error?.message || 'Erro interno ao remover logo da empresa.',
        });
    }
}

export default {
    uploadEnterpriseLogo,
    deleteEnterpriseLogo,
};
