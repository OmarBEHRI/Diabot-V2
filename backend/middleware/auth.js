import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'diabot-secret-key';

function authMiddleware(req, res, next) {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  // Check if token exists
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization denied, no token provided' });
  }

  // Verify token
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Add user to request object
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
}

export default authMiddleware;
