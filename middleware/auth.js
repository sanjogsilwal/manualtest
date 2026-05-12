// middleware/auth.js — JWT-based authentication and role-based access helpers.
//
// Roles used in the app: super_admin, admin, teacher, student.
//   super_admin -> may create teachers/students/admins; full access
//   admin       -> may upload manuals, manage subjects, approve notes
//   teacher     -> may upload manuals, manage subjects, approve notes
//   student     -> may submit notes, browse public manuals/notes
//
// Helpers exported:
//   authenticate          — required login (any role)
//   optionalAuth          — populates req.admin if a valid token is present
//   requireSuperAdmin     — only super_admin
//   requireContentManager — super_admin | admin | teacher
//   JWT_SECRET            — shared secret

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tcioe-mech-secret-change-in-production';

function tokenFromReq(req) {
  const h = req.headers['authorization'];
  if (h && h.startsWith('Bearer ')) return h.substring(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

function authenticate(req, res, next) {
  const token = tokenFromReq(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, _res, next) {
  const token = tokenFromReq(req);
  if (!token) return next();
  try { req.admin = jwt.verify(token, JWT_SECRET); } catch (_) { /* ignore */ }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

function requireContentManager(req, res, next) {
  const r = req.admin?.role;
  if (!['super_admin', 'admin', 'teacher'].includes(r)) {
    return res.status(403).json({ error: 'Teacher or admin access required' });
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  requireSuperAdmin,
  requireContentManager,
  JWT_SECRET
};
