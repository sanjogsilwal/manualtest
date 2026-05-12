// routes/admin.js — Categories, departments, dashboard stats, activity log,
// login audit log, and user management.
//
// Roles allowed in the system: super_admin, admin, teacher.
// (Students do not have accounts — they use the site anonymously.)
// Only super_admin can create/edit/delete users (admins/teachers).

const express = require('express');
const bcrypt  = require('bcryptjs');
const {
  authenticate, requireSuperAdmin, requireContentManager
} = require('../middleware/auth');

const VALID_ROLES = ['super_admin', 'admin', 'teacher'];

module.exports = (db) => {
  const router = express.Router();

  // ===== Categories =====================================================

  router.get('/categories', (req, res) => {
    const categories = db.prepare(`
      SELECT c.*, COUNT(m.id) AS manual_count
        FROM categories c
        LEFT JOIN manuals m ON c.id = m.category_id AND m.is_public = 1
       GROUP BY c.id
       ORDER BY c.name
    `).all();
    res.json({ categories });
  });

  router.post('/categories', authenticate, requireContentManager, (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
      const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)')
        .run(name.trim(), description || '');
      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'CATEGORY_CREATE', `Created category: ${name}`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(400).json({ error: 'Category already exists' });
    }
  });

  router.put('/categories/:id', authenticate, requireContentManager, (req, res) => {
    const { name, description } = req.body;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
      .run(name ?? cat.name, description ?? cat.description, req.params.id);
    res.json({ success: true });
  });

  router.delete('/categories/:id', authenticate, requireContentManager, (req, res) => {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'CATEGORY_DELETE', `Deleted category: ${cat.name}`);
    res.json({ success: true });
  });

  // ===== Departments ====================================================
  // Public list (used to populate department dropdowns).
  router.get('/departments', (req, res) => {
    const rows = db.prepare(`
      SELECT d.*,
             (SELECT COUNT(*) FROM subjects s WHERE s.department = d.code) AS subject_count
        FROM departments d
       ORDER BY d.name
    `).all();
    res.json({ departments: rows });
  });

  // Mutations are super_admin only (create/edit/delete entire departments).
  router.post('/departments', authenticate, requireSuperAdmin, (req, res) => {
    const { name, code, description } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code are required' });
    const slug = code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!slug) return res.status(400).json({ error: 'Code must contain alphanumeric characters' });
    if (slug === 'both') return res.status(400).json({ error: '"both" is reserved' });
    try {
      const result = db.prepare('INSERT INTO departments (name, code, description) VALUES (?, ?, ?)')
        .run(name.trim(), slug, description || '');
      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'DEPT_CREATE', `Created department: ${name} (${slug})`);
      res.json({ success: true, id: result.lastInsertRowid, code: slug });
    } catch (err) {
      if (String(err.message).includes('UNIQUE'))
        return res.status(400).json({ error: 'A department with that name or code already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/departments/:id', authenticate, requireSuperAdmin, (req, res) => {
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const { name, description } = req.body;
    db.prepare('UPDATE departments SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
      .run(name ?? null, description ?? null, req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'DEPT_UPDATE', `Updated department: ${dept.name}`);
    res.json({ success: true });
  });

  router.delete('/departments/:id', authenticate, requireSuperAdmin, (req, res) => {
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const linked = db.prepare('SELECT COUNT(*) AS c FROM subjects WHERE department = ?').get(dept.code).c;
    if (linked > 0)
      return res.status(400).json({ error: `Cannot delete: ${linked} subject(s) still belong to this department` });
    db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'DEPT_DELETE', `Deleted department: ${dept.name}`);
    res.json({ success: true });
  });

  // ===== Dashboard ======================================================

  router.get('/stats', authenticate, (req, res) => {
    const get = (q) => db.prepare(q).get().c;
    const stats = {
      totalManuals:    get('SELECT COUNT(*) AS c FROM manuals'),
      publicManuals:   get('SELECT COUNT(*) AS c FROM manuals WHERE is_public = 1'),
      privateManuals:  get('SELECT COUNT(*) AS c FROM manuals WHERE is_public = 0'),
      totalCategories: get('SELECT COUNT(*) AS c FROM categories'),
      totalSubjects:   get('SELECT COUNT(*) AS c FROM subjects'),
      totalDepts:      get('SELECT COUNT(*) AS c FROM departments'),
      totalUsers:      get('SELECT COUNT(*) AS c FROM admins'),
      totalDownloads:  get('SELECT COALESCE(SUM(download_count),0) AS c FROM manuals'),
      totalNotes:      get('SELECT COUNT(*) AS c FROM student_notes'),
      pendingNotes:    get("SELECT COUNT(*) AS c FROM student_notes WHERE status = 'pending'")
    };

    const recentActivity = db.prepare(`
      SELECT al.*, a.username, a.full_name
        FROM activity_log al
        LEFT JOIN admins a ON al.admin_id = a.id
       ORDER BY al.created_at DESC
       LIMIT 10
    `).all();

    const topDownloaded = db.prepare(`
      SELECT id, title, download_count
        FROM manuals
       WHERE is_public = 1
       ORDER BY download_count DESC
       LIMIT 5
    `).all();

    res.json({ stats, recentActivity, topDownloaded });
  });

  // ===== User management ================================================

  router.get('/users', authenticate, requireContentManager, (req, res) => {
    const { role, department } = req.query;
    let sql = 'SELECT id, username, email, full_name, role, department, is_active, created_at FROM admins WHERE 1=1';
    const params = [];
    if (role)       { sql += ' AND role = ?';       params.push(role); }
    if (department) { sql += ' AND department = ?'; params.push(department); }
    sql += ' ORDER BY role, full_name';
    res.json({ users: db.prepare(sql).all(...params) });
  });

  router.post('/users', authenticate, requireSuperAdmin, (req, res) => {
    const { username, email, password, full_name, role, department } = req.body;
    if (!username || !email || !password || !full_name)
      return res.status(400).json({ error: 'Username, email, full name and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (role && !VALID_ROLES.includes(role))
      return res.status(400).json({ error: 'Invalid role (must be super_admin, admin, or teacher)' });

    try {
      const hash = bcrypt.hashSync(password, 10);
      const result = db.prepare(`
        INSERT INTO admins (username, email, password_hash, full_name, role, department)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        username.trim(),
        email.trim().toLowerCase(),
        hash,
        full_name.trim(),
        role || 'admin',
        department || null
      );
      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'USER_CREATE', `Created ${role || 'admin'}: ${username}`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      if (String(err.message).includes('UNIQUE'))
        return res.status(400).json({ error: 'Username or email already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', authenticate, requireSuperAdmin, (req, res) => {
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    const { full_name, email, role, department, is_active, password } = req.body;
    if (role && !VALID_ROLES.includes(role))
      return res.status(400).json({ error: 'Invalid role' });

    db.prepare(`
      UPDATE admins
         SET full_name  = COALESCE(?, full_name),
             email      = COALESCE(?, email),
             role       = COALESCE(?, role),
             department = COALESCE(?, department),
             is_active  = COALESCE(?, is_active)
       WHERE id = ?
    `).run(
      full_name ?? null,
      email ?? null,
      role ?? null,
      department ?? null,
      is_active === undefined ? null : (is_active ? 1 : 0),
      req.params.id
    );
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?')
        .run(bcrypt.hashSync(password, 10), req.params.id);
    }
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'USER_UPDATE', `Updated user: ${target.username}`);
    res.json({ success: true });
  });

  router.delete('/users/:id', authenticate, requireSuperAdmin, (req, res) => {
    if (parseInt(req.params.id) === req.admin.id)
      return res.status(400).json({ error: 'You cannot delete your own account' });
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'USER_DELETE', `Removed user: ${target.username}`);
    res.json({ success: true });
  });

  // ===== Activity log ===================================================

  router.get('/activity', authenticate, (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const activities = db.prepare(`
      SELECT al.*, a.username, a.full_name
        FROM activity_log al
        LEFT JOIN admins a ON al.admin_id = a.id
       ORDER BY al.created_at DESC
       LIMIT ?
    `).all(limit);
    res.json({ activities });
  });

  // ===== Login audit log ================================================
  // Lists login/logout entries for admins and teachers (super_admin actions
  // are not recorded). Visible to any signed-in user (manager).
  router.get('/login-log', authenticate, requireContentManager, (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const rows = db.prepare(`
      SELECT * FROM login_log
       ORDER BY created_at DESC
       LIMIT ?
    `).all(limit);
    res.json({ entries: rows });
  });

  return router;
};
