import express from 'express';
import { check } from 'express-validator';
import {
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase
} from '../controllers/caseController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get all cases
router.get('/', auth, getAllCases);

// Get case by ID
router.get('/:id', auth, getCaseById);

// Create new case
router.post(
  '/',
  [
    auth,
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('category', 'Category is required').not().isEmpty()
  ],
  createCase
);

// Update case
router.put(
  '/:id',
  [
    auth,
    check('title', 'Title is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('category', 'Category is required').not().isEmpty()
  ],
  updateCase
);

// Delete case
router.delete('/:id', auth, deleteCase);

export default router;
