// appFeaturesRoutes.js — HTTP routes

import { Router } from 'express';
import {
    deleteAssignment,
    getByCode,
    list,
    options,
    resolve,
    saveAssignment,
} from '../controllers/appFeaturesController.js';

const router = Router();

router.get('/', list);
router.get('/:featureCode/options', options);
router.get('/:featureCode/resolve', resolve);
router.get('/:featureCode', getByCode);
router.put('/:featureCode/assignment', saveAssignment);
router.delete('/:featureCode/assignment', deleteAssignment);

export default router;

