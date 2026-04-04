const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await query(
      `SELECT u.*, r.name as role_name FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

const requireSystemAdmin = requireRole('system_admin');
const requireManager = requireRole('system_admin', 'super_admin', 'pre_sales_manager');

const checkPermission = (module, action) => {
  return async (req, res, next) => {
    const { role_name, id } = req.user;

    // System admin has all permissions
    if (role_name === 'system_admin') return next();

    // For super_admin, check if system admin has restricted them
    if (role_name === 'super_admin') {
      const permResult = await query(
        `SELECT * FROM user_permissions WHERE user_id = $1 AND module = $2`,
        [id, module]
      );
      if (permResult.rows.length > 0) {
        const perm = permResult.rows[0];
        if (action === 'create' && !perm.can_create) {
          return res.status(403).json({ error: 'Permission denied' });
        }
        if (action === 'update' && !perm.can_update) {
          return res.status(403).json({ error: 'Permission denied' });
        }
      }
      return next();
    }

    // Pre-sales manager has full access
    if (role_name === 'pre_sales_manager') return next();

    // Pre-sales executive - limited permissions
    if (role_name === 'pre_sales_executive') {
      if (action === 'create' && module === 'user_stories') {
        return res.status(403).json({ error: 'Executives cannot create user stories' });
      }
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

module.exports = { authenticate, requireRole, requireSystemAdmin, requireManager, checkPermission };
