import pool from '../config/db.js';

// @desc    Get messages for a specific case
// @route   GET /api/messages/case/:caseId
// @access  Private
export const getCaseMessages = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    // Check if user has access to this case
    const [caseCheck] = await pool.execute(
      'SELECT c.*, b.status as bid_status, b.lawyer_id FROM cases c LEFT JOIN bids b ON c.id = b.case_id WHERE c.id = ?',
      [caseId]
    );
    
    if (caseCheck.length === 0) {
      return res.status(404).json({ message: 'Case not found' });
    }
    
    const caseData = caseCheck[0];
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Permission check: only client, accepted lawyer, or admin can access messages
    let hasAccess = false;
    
    if (userRole === 'admin') {
      hasAccess = true;
    } else if (userRole === 'client' && caseData.user_id === userId) {
      hasAccess = true;
    } else if (userRole === 'lawyer' && caseData.lawyer_id === userId && caseData.bid_status === 'accepted') {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get messages
    const [messages] = await pool.execute(
      `SELECT m.*, u.name as sender_name, u.role as sender_role 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.case_id = ? 
       ORDER BY m.created_at ASC`,
      [caseId]
    );
    
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { caseId, content, receiverId, messageType = 'text', fileUrl = null, fileName = null } = req.body;
    
    console.log('Message request received:', {
      caseId,
      content,
      receiverId,
      messageType,
      userId: req.user.id,
      userRole: req.user.role
    });
    
    // Check if user has access to this case
    const [caseCheck] = await pool.execute(
      'SELECT c.*, b.status as bid_status, b.lawyer_id FROM cases c LEFT JOIN bids b ON c.id = b.case_id WHERE c.id = ?',
      [caseId]
    );
    
    console.log('Case check result:', caseCheck);
    
    if (caseCheck.length === 0) {
      console.log('Case not found');
      return res.status(404).json({ message: 'Case not found' });
    }
    
    const caseData = caseCheck[0];
    const userId = req.user.id;
    const userRole = req.user.role;
    
    console.log('Case data:', caseData);
    console.log('User info:', { userId, userRole });
    
    // Permission check
    let hasAccess = false;
    let validReceiver = false;
    
    if (userRole === 'admin') {
      hasAccess = true;
      validReceiver = true;
    } else if (userRole === 'client' && caseData.user_id === userId) {
      hasAccess = true;
      validReceiver = caseData.lawyer_id === parseInt(receiverId) && caseData.bid_status === 'accepted';
      console.log('Client access check:', {
        caseUserId: caseData.user_id,
        userId,
        lawyerId: caseData.lawyer_id,
        receiverId: parseInt(receiverId),
        bidStatus: caseData.bid_status,
        validReceiver
      });
    } else if (userRole === 'lawyer' && caseData.lawyer_id === userId && caseData.bid_status === 'accepted') {
      hasAccess = true;
      validReceiver = caseData.user_id === parseInt(receiverId);
      console.log('Lawyer access check:', {
        caseLawyerId: caseData.lawyer_id,
        userId,
        caseUserId: caseData.user_id,
        receiverId: parseInt(receiverId),
        bidStatus: caseData.bid_status,
        validReceiver
      });
    }
    
    console.log('Permission check result:', { hasAccess, validReceiver });
    
    if (!hasAccess || !validReceiver) {
      console.log('Access denied');
      return res.status(403).json({ message: 'Access denied - you can only chat if a bid is accepted' });
    }
    
    // Create message
    const [result] = await pool.execute(
      `INSERT INTO messages (case_id, sender_id, receiver_id, content, message_type, file_url, file_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [caseId, userId, receiverId, content, messageType, fileUrl, fileName]
    );
    
    // Get the created message with sender info
    const [newMessage] = await pool.execute(
      `SELECT m.*, u.name as sender_name, u.role as sender_role 
       FROM messages m 
       JOIN users u ON m.sender_id = u.id 
       WHERE m.id = ?`,
      [result.insertId]
    );
    
    res.status(201).json(newMessage[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:caseId
// @access  Private
export const markMessagesAsRead = async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    
    // Mark all unread messages for this user in this case as read
    const [result] = await pool.execute(
      'UPDATE messages SET is_read = TRUE, updated_at = NOW() WHERE case_id = ? AND receiver_id = ? AND is_read = FALSE',
      [caseId, userId]
    );
    
    res.json({ message: 'Messages marked as read', count: result.affectedRows });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get unread message count for user
// @route   GET /api/messages/unread
// @access  Private
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [result] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE',
      [userId]
    );
    
    res.json({ unreadCount: result[0].count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get chat partners for user
// @route   GET /api/messages/partners
// @access  Private
export const getChatPartners = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let query = '';
    let params = [];
    
    if (userRole === 'client') {
      // Get cases where client has accepted bids
      query = `
        SELECT DISTINCT c.id as case_id, c.title, u.id as partner_id, u.name as partner_name, 'lawyer' as partner_role
        FROM cases c
        JOIN bids b ON c.id = b.case_id
        JOIN users u ON b.lawyer_id = u.id
        WHERE c.user_id = ? AND b.status = 'accepted'
      `;
      params = [userId];
    } else if (userRole === 'lawyer') {
      // Get cases where lawyer has accepted bids
      query = `
        SELECT DISTINCT c.id as case_id, c.title, u.id as partner_id, u.name as partner_name, 'client' as partner_role
        FROM cases c
        JOIN bids b ON c.id = b.case_id
        JOIN users u ON c.user_id = u.id
        WHERE b.lawyer_id = ? AND b.status = 'accepted'
      `;
      params = [userId];
    } else if (userRole === 'admin') {
      // Admin can see all active chats
      query = `
        SELECT DISTINCT c.id as case_id, c.title, u.id as partner_id, u.name as partner_name, u.role as partner_role
        FROM cases c
        JOIN bids b ON c.id = b.case_id AND b.status = 'accepted'
        JOIN users u ON (c.user_id = u.id OR b.lawyer_id = u.id)
        WHERE u.id != ?
      `;
      params = [userId];
    }
    
    const [partners] = await pool.execute(query, params);
    res.json(partners);
  } catch (error) {
    console.error('Error getting chat partners:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
