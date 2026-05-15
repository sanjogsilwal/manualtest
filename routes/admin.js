// routes/admin.js — Categories, departments, dashboard stats, activity log,
// login audit log, and user management.
//
// Roles allowed in the system: super_admin, admin, teacher.
// Hierarchy:
//   super_admin → creates/manages admins (and teachers); full access
//   admin       → creates/manages teachers only; no department management
//   teacher     → content management (manuals, notes, subjects); read-only on users

const express = require('express');
const bcrypt  = require('bcryptjs');
const {
  authenticate, requireSuperAdmin, requireContentManager
} = require('../middleware/auth');

const VALID_ROLES = ['super_admin', 'admin', 'teacher'];

module.exports = (db) => {
  const router = express.Router();

  // Ensure created_by column exists (safe to run on every boot).
  try {
    const cols = db.prepare('PRAGMA table_info(admins)').all();
    if (!cols.find(c => c.name === 'created_by')) {
      db.exec('ALTER TABLE admins ADD COLUMN created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL');
    }
  } catch (_) {}

  // Inline middleware: admin or super_admin only.
  function requireAdminOrAbove(req, res, next) {
    const r = req.admin?.role;
    if (r !== 'super_admin' && r !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });
    next();
  }

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

  router.post('/categories', authenticate, requireAdminOrAbove, (req, res) => {
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

  router.put('/categories/:id', authenticate, requireAdminOrAbove, (req, res) => {
    const { name, description } = req.body;
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
      .run(name ?? cat.name, description ?? cat.description, req.params.id);
    res.json({ success: true });
  });

  router.delete('/categories/:id', authenticate, requireAdminOrAbove, (req, res) => {
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

    const deleteDept = db.transaction(() => {
      // Find subjects in this dept that already have a duplicate in 'both' (same name+semester).
      // For those, remap manuals/notes to the existing 'both' subject, then delete the duplicate.
      const conflicts = db.prepare(`
        SELECT s.id AS src_id, b.id AS dst_id
        FROM subjects s
        JOIN subjects b ON b.name = s.name AND b.semester = s.semester AND b.department = 'both'
        WHERE s.department = ?
      `).all(dept.code);

      for (const { src_id, dst_id } of conflicts) {
        db.prepare("UPDATE manuals       SET subject_id = ? WHERE subject_id = ?").run(dst_id, src_id);
        db.prepare("UPDATE student_notes SET subject_id = ? WHERE subject_id = ?").run(dst_id, src_id);
        db.prepare("DELETE FROM subjects WHERE id = ?").run(src_id);
      }

      // Move remaining subjects (no conflict) to 'both'.
      const subjectsMoved = db.prepare("UPDATE subjects SET department = 'both' WHERE department = ?").run(dept.code).changes;
      const manualsMoved  = db.prepare("UPDATE manuals SET department = 'both' WHERE department = ?").run(dept.code).changes;
      const notesMoved    = db.prepare("UPDATE student_notes SET department = 'both' WHERE department = ?").run(dept.code).changes;

      db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'DEPT_DELETE',
          `Deleted department: ${dept.name} (${subjectsMoved} subjects, ${manualsMoved} manuals, ${notesMoved} notes moved to All Departments)`);

      return { subjectsMoved, manualsMoved, notesMoved };
    });

    const result = deleteDept();
    res.json({ success: true, ...result });
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

  router.post('/users', authenticate, requireAdminOrAbove, (req, res) => {
    const requestorRole = req.admin.role;
    const { username, email, password, full_name, role, department } = req.body;
    if (!username || !email || !password || !full_name)
      return res.status(400).json({ error: 'Username, email, full name and password are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    // Admins can only create teachers; super_admin can create any role.
    let targetRole = role || (requestorRole === 'admin' ? 'teacher' : 'admin');
    if (requestorRole === 'admin' && targetRole !== 'teacher')
      return res.status(403).json({ error: 'Admins can only create teacher accounts' });
    if (!VALID_ROLES.includes(targetRole))
      return res.status(400).json({ error: 'Invalid role' });

    try {
      const hash = bcrypt.hashSync(password, 10);
      const result = db.prepare(`
        INSERT INTO admins (username, email, password_hash, full_name, role, department, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        username.trim(),
        email.trim().toLowerCase(),
        hash,
        full_name.trim(),
        targetRole,
        department || null,
        req.admin.id
      );
      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'USER_CREATE', `Created ${targetRole}: ${username}`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      if (String(err.message).includes('UNIQUE'))
        return res.status(400).json({ error: 'Username or email already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id', authenticate, requireAdminOrAbove, (req, res) => {
    const requestorRole = req.admin.role;
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Admins can only edit teachers; cannot change a teacher's role.
    if (requestorRole === 'admin') {
      if (target.role !== 'teacher')
        return res.status(403).json({ error: 'Admins can only edit teacher accounts' });
    }

    const { full_name, email, role, department, is_active, password } = req.body;
    if (role && !VALID_ROLES.includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    // Admins cannot change a teacher's role.
    const newRole = (requestorRole === 'admin') ? null : (role ?? null);

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
      newRole,
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

  router.delete('/users/:id', authenticate, requireAdminOrAbove, (req, res) => {
    const requestorRole = req.admin.role;
    if (parseInt(req.params.id) === req.admin.id)
      return res.status(400).json({ error: 'You cannot delete your own account' });
    const target = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });

    // Admins can only delete teachers.
    if (requestorRole === 'admin' && target.role !== 'teacher')
      return res.status(403).json({ error: 'Admins can only remove teacher accounts' });

    db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'USER_DELETE', `Removed user: ${target.username} (${target.role})`);
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
