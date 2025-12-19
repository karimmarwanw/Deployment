const jwt = require('jsonwebtoken');

/**
 * Optional auth middleware: decodes a valid bearer token if present,
 * but allows unauthenticated requests to proceed.
 */
const optionalAuth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = optionalAuth;
