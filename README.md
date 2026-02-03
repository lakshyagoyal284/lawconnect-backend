# LawConnect Backend

Backend API for LawConnect legal services platform.

## 🚀 Features

- User authentication (JWT)
- Case management
- Bidding system
- Real-time chat (Socket.IO)
- Payment processing (Razorpay)
- MySQL database

## 📦 Dependencies

- Express.js
- MySQL2
- Socket.IO
- JWT
- Razorpay
- Bcrypt

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lawconnect_db
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
PORT=5004
NODE_ENV=production
```

## 🚀 Deployment

This backend is designed for deployment on Railway, Heroku, or any Node.js hosting platform.

## 📡 API Endpoints

- `/api/auth` - Authentication
- `/api/cases` - Case management
- `/api/bids` - Bidding system
- `/api/messages` - Chat messages
- `/api/payments` - Payment processing

## 🔌 WebSocket

Real-time chat available on Socket.IO connection.
