// routes/subjects.js — CRUD for subjects (admins/teachers manage them).
//
// A subject belongs to:
//   - department: any department.code from the `departments` table, OR 'both'
//   - semester:   "1st Semester" … "8th Semester"
//
// Subjects are returned sorted by department then semester then name so
// callers can group them by department in the UI.

const express = require('express');
const { authenticate, requireContentManager } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();

  function knownDepartmentCodes() {
    const codes = db.prepare('SELECT code FROM departments').all().map(r => r.code);
    return new Set([...codes, 'both']);
  }

  // GET /api/subjects
  router.get('/', (req, res) => {
    const { department, semester, sort } = req.query;
    let sql = `
      SELECT s.*,
             (SELECT COUNT(*) FROM manuals       m WHERE m.subject_id = s.id) AS manual_count,
             (SELECT COUNT(*) FROM student_notes n WHERE n.subject_id = s.id AND n.status = 'approved') AS notes_count
        FROM subjects s
       WHERE 1=1
    `;
    const params = [];
    if (department && department !== 'both') {
      sql += " AND (s.department = ? OR s.department = 'both')";
      params.push(department);
    }
    if (semester) { sql += ' AND s.semester = ?'; params.push(semester); }
    // Default ordering groups by department first so the UI can render
    // departmental sections in order.
    sql += sort === 'name'
      ? ' ORDER BY s.name'
      : ' ORDER BY s.department, s.semester, s.name';
    res.json({ subjects: db.prepare(sql).all(...params) });
  });

  router.get('/:id', (req, res) => {
    const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Subject not found' });
    res.json({ subject: s });
  });

  router.post('/', authenticate, requireContentManager, (req, res) => {
    const { name, code, department, semester, description } = req.body;
    if (!name || !semester) return res.status(400).json({ error: 'Name and semester are required' });
    const valid = knownDepartmentCodes();
    const dept  = valid.has(department) ? department : 'both';
    try {
      const result = db.prepare(`
        INSERT INTO subjects (name, code, department, semester, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(name.trim(), code || '', dept, semester, description || '');
      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'SUBJECT_CREATE', `Created subject: ${name} (${dept}, ${semester})`);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      if (String(err.message).includes('UNIQUE'))
        return res.status(400).json({ error: 'A subject with the same name already exists for this department/semester' });
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', authenticate, requireContentManager, (req, res) => {
    const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Subject not found' });
    const { name, code, department, semester, description } = req.body;
    const valid = knownDepartmentCodes();
    const dept  = valid.has(department) ? department : s.department;
    db.prepare(`
      UPDATE subjects SET name = ?, code = ?, department = ?, semester = ?, description = ?
       WHERE id = ?
    `).run(name ?? s.name, code ?? s.code, dept, semester ?? s.semester, description ?? s.description, req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'SUBJECT_UPDATE', `Updated subject: ${name || s.name}`);
    res.json({ success: true });
  });

  router.delete('/:id', authenticate, requireContentManager, (req, res) => {
    const s = db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Subject not found' });
    db.prepare('DELETE FROM subjects WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'SUBJECT_DELETE', `Deleted subject: ${s.name}`);
    res.json({ success: true });
  });

  return router;
};
