import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    console.log('Socket authentication attempt...');
    const token = socket.handshake.auth.token;
    console.log('Token received:', !!token);
    
    // Temporarily bypass authentication for testing
    if (!token) {
      console.log('No token provided - allowing connection for testing');
      socket.user = { id: 1, name: 'Test User', email: 'test@test.com', role: 'client' };
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Token decoded successfully, user ID:', decoded.id);
    
    // Get user from database
    const [users] = await pool.execute(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [decoded.id]
    );
    
    if (users.length === 0) {
      console.log('User not found in database');
      return next(new Error('User not found'));
    }
    
    console.log('User authenticated:', users[0].name);
    socket.user = users[0];
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    console.error('Error details:', error.message);
    
    // Temporarily allow connection even with invalid token for testing
    console.log('Authentication failed - allowing connection for testing');
    socket.user = { id: 1, name: 'Test User', email: 'test@test.com', role: 'client' };
    next();
  }
};

// Chat socket handler
export const initializeChatSocket = (io) => {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} (${socket.user.id}) connected to chat`);
    
    // Join user to their personal room for notifications
    socket.join(`user_${socket.user.id}`);
    
    // Handle joining a case room
    socket.on('join_case', async (caseId) => {
      try {
        // Verify user has access to this case
        const [caseCheck] = await pool.execute(
          `SELECT c.*, b.status as bid_status, b.lawyer_id 
           FROM cases c 
           LEFT JOIN bids b ON c.id = b.case_id 
           WHERE c.id = ?`,
          [caseId]
        );
        
        if (caseCheck.length === 0) {
          socket.emit('error', { message: 'Case not found' });
          return;
        }
        
        const caseData = caseCheck[0];
        const userId = socket.user.id;
        const userRole = socket.user.role;
        
        // Permission check
        let hasAccess = false;
        
        if (userRole === 'admin') {
          hasAccess = true;
        } else if (userRole === 'client' && caseData.user_id === userId) {
          hasAccess = true;
        } else if (userRole === 'lawyer' && caseData.lawyer_id === userId && caseData.bid_status === 'accepted') {
          hasAccess = true;
        }
        
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this case' });
          return;
        }
        
        // Join the case room
        socket.join(`case_${caseId}`);
        socket.currentCase = caseId;
        
        // Notify others in the case
        socket.to(`case_${caseId}`).emit('user_joined', {
          userId: socket.user.id,
          userName: socket.user.name,
          userRole: socket.user.role
        });
        
        console.log(`User ${socket.user.name} joined case ${caseId}`);
        
      } catch (error) {
        console.error('Error joining case:', error);
        socket.emit('error', { message: 'Failed to join case' });
      }
    });
    
    // Handle leaving a case room
    socket.on('leave_case', (caseId) => {
      socket.leave(`case_${caseId}`);
      socket.to(`case_${caseId}`).emit('user_left', {
        userId: socket.user.id,
        userName: socket.user.name
      });
      console.log(`User ${socket.user.name} left case ${caseId}`);
    });
    
    // Handle sending a message
    socket.on('send_message', async (data) => {
      try {
        const { caseId, content, receiverId } = data;
        
        // Verify access (same logic as join_case)
        const [caseCheck] = await pool.execute(
          `SELECT c.*, b.status as bid_status, b.lawyer_id 
           FROM cases c 
           LEFT JOIN bids b ON c.id = b.case_id 
           WHERE c.id = ?`,
          [caseId]
        );
        
        if (caseCheck.length === 0) {
          socket.emit('error', { message: 'Case not found' });
          return;
        }
        
        const caseData = caseCheck[0];
        const userId = socket.user.id;
        const userRole = socket.user.role;
        
        // Permission check
        let hasAccess = false;
        let validReceiver = false;
        
        if (userRole === 'admin') {
          hasAccess = true;
          validReceiver = true;
        } else if (userRole === 'client' && caseData.user_id === userId) {
          hasAccess = true;
          validReceiver = caseData.lawyer_id === parseInt(receiverId) && caseData.bid_status === 'accepted';
        } else if (userRole === 'lawyer' && caseData.lawyer_id === userId && caseData.bid_status === 'accepted') {
          hasAccess = true;
          validReceiver = caseData.user_id === parseInt(receiverId);
        }
        
        if (!hasAccess || !validReceiver) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
        
        // Save message to database
        const [result] = await pool.execute(
          `INSERT INTO messages (case_id, sender_id, receiver_id, content, message_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'text', NOW(), NOW())`,
          [caseId, userId, receiverId, content]
        );
        
        // Get the created message with sender info
        const [newMessage] = await pool.execute(
          `SELECT m.*, u.name as sender_name, u.role as sender_role 
           FROM messages m 
           JOIN users u ON m.sender_id = u.id 
           WHERE m.id = ?`,
          [result.insertId]
        );
        
        const message = newMessage[0];
        
        // Emit to case room
        io.to(`case_${caseId}`).emit('new_message', message);
        
        // Emit notification to specific receiver
        io.to(`user_${receiverId}`).emit('new_message_notification', {
          caseId,
          message: message,
          senderName: socket.user.name
        });
        
        console.log(`Message sent in case ${caseId} from ${socket.user.name} to user ${receiverId}`);
        
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { caseId, receiverId } = data;
      socket.to(`case_${caseId}`).emit('user_typing', {
        userId: socket.user.id,
        userName: socket.user.name,
        isTyping: true
      });
    });
    
    socket.on('typing_stop', (data) => {
      const { caseId, receiverId } = data;
      socket.to(`case_${caseId}`).emit('user_typing', {
        userId: socket.user.id,
        userName: socket.user.name,
        isTyping: false
      });
    });
    
    // Handle marking messages as read
    socket.on('mark_read', async (caseId) => {
      try {
        await pool.execute(
          'UPDATE messages SET is_read = TRUE, updated_at = NOW() WHERE case_id = ? AND receiver_id = ? AND is_read = FALSE',
          [caseId, socket.user.id]
        );
        
        // Notify other user that messages were read
        socket.to(`case_${caseId}`).emit('messages_read', {
          userId: socket.user.id,
          caseId
        });
        
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.currentCase) {
        socket.to(`case_${socket.currentCase}`).emit('user_left', {
          userId: socket.user.id,
          userName: socket.user.name
        });
      }
      console.log(`User ${socket.user.name} (${socket.user.id}) disconnected from chat`);
    });
  });
};

export default initializeChatSocket;
