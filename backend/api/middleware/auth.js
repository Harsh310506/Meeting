const jwt = require('jsonwebtoken');
const { supabase } = require('../config/database');

// Middleware to authenticate JWT token and extract user info
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Optional middleware for routes that can work with or without auth
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('id', decoded.userId)
      .single();

    req.user = error ? null : user;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = { authenticateToken, optionalAuth };