import express from 'express';
import { check } from 'express-validator';
import {
  getCaseMessages,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  getChatPartners
} from '../controllers/messageController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Get messages for a specific case
router.get('/case/:caseId', auth, getCaseMessages);

// Send a new message
router.post(
  '/',
  [
    auth,
    check('caseId', 'Case ID is required').not().isEmpty(),
    check('content', 'Message content is required').not().isEmpty(),
    check('receiverId', 'Receiver ID is required').not().isEmpty()
  ],
  sendMessage
);

// Mark messages as read
router.put('/read/:caseId', auth, markMessagesAsRead);

// Get unread message count
router.get('/unread', auth, getUnreadCount);

// Get chat partners
router.get('/partners', auth, getChatPartners);

export default router;
