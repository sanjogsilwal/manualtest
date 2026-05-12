// routes/auth.js — Login / logout / current user / change password.
//
// Login/logout actions for non-super_admin users (admin, teacher) are
// recorded in the dedicated login_log table.

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const ALLOWED_ROLES = ['super_admin', 'admin', 'teacher'];

module.exports = (db) => {
  const router = express.Router();

  function recordLogin(req, user, action) {
    if (user.role === 'super_admin') return;          // skip super_admin tracking
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString();
    const ua = (req.headers['user-agent'] || '').toString().slice(0, 250);
    db.prepare(`
      INSERT INTO login_log (user_id, username, full_name, role, action, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, user.username, user.full_name, user.role, action, ip, ua);
  }

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare(
      'SELECT * FROM admins WHERE (username = ? OR email = ?) AND COALESCE(is_active, 1) = 1'
    ).get(username, username);
    if (!user)                                            return res.status(401).json({ error: 'Invalid credentials' });
    if (!ALLOWED_ROLES.includes(user.role))               return res.status(403).json({ error: 'This account is not allowed to sign in' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      {
        id:         user.id,
        username:   user.username,
        role:       user.role,
        full_name:  user.full_name,
        department: user.department
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(user.id, 'LOGIN', `${user.username} (${user.role}) logged in`);
    recordLogin(req, user, 'LOGIN');

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    res.json({
      success: true,
      token,
      user: publicUser(user),
      admin: publicUser(user)
    });
  });

  // POST /api/auth/logout
  router.post('/logout', authenticate, (req, res) => {
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'LOGOUT', `${req.admin.username} logged out`);
    recordLogin(req, req.admin, 'LOGOUT');
    res.clearCookie('token');
    res.json({ success: true });
  });

  // GET /api/auth/me
  router.get('/me', authenticate, (req, res) => {
    const user = db.prepare(
      'SELECT id, username, email, full_name, role, department, created_at FROM admins WHERE id = ?'
    ).get(req.admin.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user, admin: user });
  });

  // POST /api/auth/change-password
  router.post('/change-password', authenticate, (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current and new passwords are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(new_password, 10), user.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(user.id, 'PASSWORD_CHANGE', `${user.username} changed password`);
    res.json({ success: true, message: 'Password changed successfully' });
  });

  return router;
};

function publicUser(u) {
  return {
    id:         u.id,
    username:   u.username,
    email:      u.email,
    full_name:  u.full_name,
    role:       u.role,
    department: u.department
  };
}
