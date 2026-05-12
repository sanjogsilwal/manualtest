// routes/notes.js — Student-submitted notes (with admin/teacher approval).
//
// Status workflow: pending -> approved | rejected
// Public listing only returns approved notes; managers see all.

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const {
  authenticate, optionalAuth, requireContentManager
} = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip', '.txt'];
const VALID_DEPT = ['automobile', 'mechanical', 'both'];

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) return cb(new Error('File type not allowed. Allowed: ' + ALLOWED.join(', ')));
    cb(null, true);
  }
});

function isManager(user) {
  return user && ['super_admin', 'admin', 'teacher'].includes(user.role);
}

module.exports = (db) => {
  const router = express.Router();

  // GET /api/notes — list notes; students only see approved ones
  router.get('/', optionalAuth, (req, res) => {
    const { department, semester, subject_id, status } = req.query;
    const manager = isManager(req.admin);

    let sql = `
      SELECT n.*,
             s.name AS subject_name,
             a.full_name AS reviewer_name
        FROM student_notes n
        LEFT JOIN subjects s ON n.subject_id  = s.id
        LEFT JOIN admins   a ON n.reviewed_by = a.id
       WHERE 1=1
    `;
    const params = [];

    // Non-managers can only see approved notes.
    if (!manager) sql += " AND n.status = 'approved'";
    else if (status) { sql += ' AND n.status = ?'; params.push(status); }

    if (department && VALID_DEPT.includes(department)) {
      if (department !== 'both') {
        sql += " AND (n.department = ? OR n.department = 'both')";
        params.push(department);
      }
    }
    if (semester)   { sql += ' AND n.semester    = ?'; params.push(semester); }
    if (subject_id) { sql += ' AND n.subject_id  = ?'; params.push(subject_id); }

    sql += ' ORDER BY n.created_at DESC';
    const notes = db.prepare(sql).all(...params);
    res.json({ notes, count: notes.length });
  });

  // GET /api/notes/:id
  router.get('/:id', optionalAuth, (req, res) => {
    const note = db.prepare(`
      SELECT n.*, s.name AS subject_name, a.full_name AS reviewer_name
        FROM student_notes n
        LEFT JOIN subjects s ON n.subject_id = s.id
        LEFT JOIN admins   a ON n.reviewed_by = a.id
       WHERE n.id = ?
    `).get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    if (note.status !== 'approved' && !isManager(req.admin)) {
      return res.status(403).json({ error: 'This note is not approved yet' });
    }
    res.json({ note });
  });

  // POST /api/notes — submit (logged-in student or anonymous)
  router.post('/', optionalAuth, upload.single('file'), (req, res) => {
    try {
      const { title, description, department, semester, subject_id, submitted_by, submitted_email } = req.body;
      if (!title || !department || !semester || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Title, department, semester and file are required' });
      }
      if (!VALID_DEPT.includes(department)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Department must be automobile, mechanical, or both' });
      }

      const subject = subject_id ? db.prepare('SELECT * FROM subjects WHERE id = ?').get(subject_id) : null;
      const name    = req.admin?.full_name || submitted_by || 'Student';
      const email   = submitted_email || '';

      const result = db.prepare(`
        INSERT INTO student_notes
          (title, description, department, semester, subject_id, subject,
           file_name, original_name, file_size, file_type,
           submitted_by, submitted_email, submitter_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description || '',
        department,
        semester,
        subject_id || null,
        subject ? subject.name : '',
        req.file.filename,
        req.file.originalname,
        req.file.size,
        path.extname(req.file.originalname).slice(1).toLowerCase(),
        name,
        email,
        req.admin?.id || null
      );
      res.json({ success: true, id: result.lastInsertRowid, message: 'Your note was submitted and is awaiting approval.' });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: err.message || 'Submission failed' });
    }
  });

  // GET /api/notes/:id/download
  router.get('/:id/download', optionalAuth, (req, res) => {
    const note = db.prepare('SELECT * FROM student_notes WHERE id = ?').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (note.status !== 'approved' && !isManager(req.admin))
      return res.status(403).send('This note is not approved yet');

    const filePath = path.join(UPLOAD_DIR, note.file_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });
    res.download(filePath, note.original_name);
  });

  // PATCH /api/notes/:id/status — approve / reject
  router.patch('/:id/status', authenticate, requireContentManager, (req, res) => {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const note = db.prepare('SELECT * FROM student_notes WHERE id = ?').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    db.prepare(`
      UPDATE student_notes
         SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `).run(status, req.admin.id, req.params.id);

    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'NOTE_REVIEW', `${status.toUpperCase()}: ${note.title}`);
    res.json({ success: true, status });
  });

  // DELETE /api/notes/:id
  router.delete('/:id', authenticate, requireContentManager, (req, res) => {
    const note = db.prepare('SELECT * FROM student_notes WHERE id = ?').get(req.params.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    const filePath = path.join(UPLOAD_DIR, note.file_name);
    if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch (_) {} }
    db.prepare('DELETE FROM student_notes WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'NOTE_DELETE', `Deleted note: ${note.title}`);
    res.json({ success: true });
  });

  return router;
};
