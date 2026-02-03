import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import caseRoutes from './routes/cases.js';
import bidRoutes from './routes/bids.js';
import messageRoutes from './routes/messages.js';
import paymentRoutes from './routes/payments.js';
import { initializeChatSocket } from './socket/chatSocket.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://advosia-backend.onrender.com', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/payments', paymentRoutes);

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5001;

// Create HTTP server for Socket.IO
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: ['https://advosia-backend.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Initialize chat socket handlers
initializeChatSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('MySQL database connection configured');
  console.log('Socket.IO chat server initialized');
});