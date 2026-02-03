import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export default async function(req, res, next) {
  // Get token from header
  const authHeader = req.header('Authorization');
  
  // Check if no token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  // Extract token from "Bearer <token>"
  const token = authHeader.substring(7);

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.user.id);
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(401).json({ message: 'Token is not valid' });
  }
}

// Middleware to check user role
export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'undefined';
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${userRole} is not authorized to access this route`
      });
    }
    next();
  };
};