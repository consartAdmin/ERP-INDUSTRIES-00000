// backend/routes/usersRoutes.js
import { Router } from 'express';
import {
  listUsers,
  searchUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/usersController.js';

const router = Router();

router.get('/', listUsers);
router.get('/search', searchUsers); // opcional
router.get('/:id', getUser);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
