import express from 'express';
import {
  createChatPayment,
  completePayment,
  checkChatAccess,
  simulatePaymentSuccess
} from '../controllers/paymentController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Middleware to protect routes

router.post('/chat-access', auth, createChatPayment);
router.get('/chat-access/:caseId', auth, checkChatAccess);
router.post('/complete', completePayment); // Webhook endpoint
router.post('/simulate/:paymentId', auth, simulatePaymentSuccess); // For testing

export default router;
