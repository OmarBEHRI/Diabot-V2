/**
 * Authentication Middleware
 * 
 * Provides JWT-based authentication for protected API routes:
 * - Verifies the presence and validity of Bearer tokens in request headers
 * - Decodes user information from valid tokens and attaches to request objects
 * - Returns appropriate error responses for unauthorized requests
 * - Uses environment variable JWT_SECRET or falls back to a default key
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'diabot-secret-key';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization denied, no token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
}

export default authMiddleware;
