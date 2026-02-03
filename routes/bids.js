import express from 'express';
import { check } from 'express-validator';
import {
  createBid,
  getBidsByCase,
  updateBidStatus
} from '../controllers/bidController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Create new bid
router.post(
  '/',
  [
    auth,
    check('case_id', 'Case ID is required').not().isEmpty(),
    check('amount', 'Bid amount is required').isNumeric(),
    check('message', 'Bid message is required').not().isEmpty()
  ],
  createBid
);

// Get bids for a case
router.get('/case/:caseId', auth, getBidsByCase);

// Update bid status (accept/reject)
router.put(
  '/:id/status',
  [
    auth,
    check('status', 'Status is required').isIn(['accepted', 'rejected'])
  ],
  updateBidStatus
);

export default router;
