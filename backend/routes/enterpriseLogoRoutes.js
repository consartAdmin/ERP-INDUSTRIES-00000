// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseLogoRoutes.js — Upload/remoção da logo de empresas         ║
// ║ CONSART ERP | Express Router | ESM                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { Router } from 'express';
import multer from 'multer';
import {
    deleteEnterpriseLogo,
    uploadEnterpriseLogo,
} from '../controllers/enterpriseLogoController.js';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            const error = new Error('Formato inválido. Use PNG, JPG/JPEG ou WebP.');
            error.code = 'INVALID_ENTERPRISE_LOGO_TYPE';
            return callback(error);
        }

        return callback(null, true);
    },
});

function uploadLogoMiddleware(req, res, next) {
    upload.single('logo')(req, res, (error) => {
        if (!error) return next();

        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                ok: false,
                error: 'A logo deve possuir no máximo 5 MB.',
            });
        }

        return res.status(400).json({
            ok: false,
            error: error?.message || 'Arquivo de logo inválido.',
        });
    });
}

router.post('/:id/logo', uploadLogoMiddleware, uploadEnterpriseLogo);
router.delete('/:id/logo', deleteEnterpriseLogo);

export default router;
