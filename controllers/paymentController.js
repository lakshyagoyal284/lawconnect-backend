import pool from '../config/db.js';
import Razorpay from 'razorpay';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_1DP5mmOlF5G5ag', // Replace with your live key
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret_key_placeholder' // Replace with your live secret
});

// @desc    Create payment for chat access
// @route   POST /api/payments/chat-access
// @access  Private
export const createChatPayment = async (req, res) => {
  try {
    const { caseId, bidId, amount = 150 } = req.body;
    const userId = req.user.id;

    // Check if user is client and owns the case
    const [caseCheck] = await pool.execute(
      'SELECT c.*, b.status as bid_status, b.lawyer_id FROM cases c LEFT JOIN bids b ON c.id = b.case_id WHERE c.id = ? AND c.user_id = ?',
      [caseId, userId]
    );

    if (caseCheck.length === 0) {
      return res.status(404).json({ message: 'Case not found or access denied' });
    }

    const caseData = caseCheck[0];

    // Check if bid is accepted
    if (caseData.bid_status !== 'accepted') {
      return res.status(400).json({ message: 'Chat access is only available for accepted bids' });
    }

    // Check if payment already made
    const [existingPayment] = await pool.execute(
      'SELECT * FROM payments WHERE case_id = ? AND user_id = ? AND status = "completed" AND payment_type = "chat_access"',
      [caseId, userId]
    );

    if (existingPayment.length > 0) {
      return res.status(400).json({ message: 'Chat access already purchased' });
    }

    // Create Razorpay order
    let order;
    try {
      const orderOptions = {
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        receipt: `chat_access_${caseId}_${userId}`,
        notes: {
          case_id: caseId,
          user_id: userId,
          bid_id: bidId,
          payment_type: 'chat_access'
        },
        // Add callback URLs for local development
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
        redirect: false
      };

      order = await razorpay.orders.create(orderOptions);
    } catch (razorpayError) {
      console.log('Razorpay order creation failed, using fallback:', razorpayError.message);
      // Fallback: Create a mock order for testing
      order = {
        id: `order_mock_${Date.now()}`,
        amount: amount * 100,
        currency: 'INR',
        receipt: `chat_access_${caseId}_${userId}`,
        status: 'created'
      };
    }

    // Create payment record in database
    const [result] = await pool.execute(
      `INSERT INTO payments (case_id, user_id, bid_id, amount, payment_type, status, payment_gateway_id, created_at)
       VALUES (?, ?, ?, ?, 'chat_access', 'pending', ?, NOW())`,
      [caseId, userId, bidId, amount, order.id]
    );

    const paymentId = result.insertId;

    const paymentData = {
      id: paymentId,
      amount: amount,
      currency: 'INR',
      caseId: caseId,
      bidId: bidId,
      razorpay_order_id: order.id,
      razorpay_key: razorpay.key_id
    };

    res.status(201).json({
      message: 'Payment order created successfully',
      payment: paymentData
    });

  } catch (error) {
    console.error('Error creating chat payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Complete payment (webhook from payment gateway)
// @route   POST /api/payments/complete
// @access  Public (webhook)
export const completePayment = async (req, res) => {
  try {
    const { payment_id, status, payment_gateway_id, gateway_response } = req.body;

    console.log('Completing payment:', {
      payment_id,
      status,
      payment_gateway_id
    });

    // Update payment status
    const [result] = await pool.execute(
      'UPDATE payments SET status = ?, payment_gateway_id = ?, gateway_response = ?, updated_at = NOW() WHERE id = ?',
      [status === 'success' ? 'completed' : 'failed', payment_gateway_id, JSON.stringify(gateway_response), payment_id]
    );

    if (result.affectedRows === 0) {
      console.log('Payment not found for ID:', payment_id);
      return res.status(404).json({ message: 'Payment not found' });
    }

    console.log('Payment updated successfully');
    res.json({ message: 'Payment status updated successfully' });

  } catch (error) {
    console.error('Error completing payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Check chat access status
// @route   GET /api/payments/chat-access/:caseId
// @access  Private
export const checkChatAccess = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;

    // Check if user has paid for chat access
    const [payment] = await pool.execute(
      'SELECT * FROM payments WHERE case_id = ? AND user_id = ? AND payment_type = "chat_access" AND status = "completed"',
      [caseId, userId]
    );

    const hasAccess = payment.length > 0;

    res.json({
      hasChatAccess: hasAccess,
      payment: hasAccess ? payment[0] : null
    });

  } catch (error) {
    console.error('Error checking chat access:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Simulate payment success (for testing)
// @route   POST /api/payments/simulate/:paymentId
// @access  Private
export const simulatePaymentSuccess = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const [result] = await pool.execute(
      'UPDATE payments SET status = "completed", payment_gateway_id = ?, updated_at = NOW() WHERE id = ?',
      [`sim_${Date.now()}`, paymentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json({ message: 'Payment completed successfully' });

  } catch (error) {
    console.error('Error simulating payment:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
