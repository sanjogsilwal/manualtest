// routes/manuals.js — CRUD for lab manuals + file upload + download.
// Visibility rules (Public / Private):
//   - Public  manuals are visible to anyone (logged in or not).
//   - Private manuals are only visible to authenticated users (any role).
//
// Department filter:
//   - department = automobile -> only Automobile students see it
//   - department = mechanical -> only Mechanical students see it
//   - department = both       -> visible to both departments

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

const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const safe = crypto.randomBytes(12).toString('hex');
      cb(null, `${Date.now()}-${safe}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) return cb(new Error('File type not allowed. Allowed: ' + ALLOWED.join(', ')));
    cb(null, true);
  }
});

function normaliseDepartment(d) {
  const v = (d || '').toLowerCase().trim();
  if (['automobile', 'mechanical', 'both'].includes(v)) return v;
  return 'both';
}
const VALID_DEPT = (d) => ['automobile', 'mechanical', 'both'].includes(d);

module.exports = (db) => {
  const router = express.Router();

  // GET /api/manuals — list with filtering
  router.get('/', optionalAuth, (req, res) => {
    const { category, search, semester, department, subject_id } = req.query;
    const isLoggedIn = !!req.admin;

    let sql = `
      SELECT m.*,
             c.name AS category_name,
             s.name AS subject_name,
             a.full_name AS uploader_name
        FROM manuals m
        LEFT JOIN categories c ON m.category_id = c.id
        LEFT JOIN subjects   s ON m.subject_id  = s.id
        LEFT JOIN admins     a ON m.uploaded_by = a.id
       WHERE 1=1
    `;
    const params = [];

    // Anonymous visitors only see public manuals.
    if (!isLoggedIn) sql += ' AND m.is_public = 1';

    if (category)   { sql += ' AND m.category_id = ?'; params.push(category); }
    if (subject_id) { sql += ' AND m.subject_id  = ?'; params.push(subject_id); }
    if (semester)   { sql += ' AND m.semester    = ?'; params.push(semester); }
    if (department && VALID_DEPT(department)) {
      // 'both' student sees both-department + own; otherwise show department or 'both'
      if (department === 'both') {
        // no extra filter — show all departments
      } else {
        sql += " AND (m.department = ? OR m.department = 'both')";
        params.push(department);
      }
    }
    if (search) {
      sql += ' AND (m.title LIKE ? OR m.description LIKE ? OR m.subject LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY m.created_at DESC';
    const manuals = db.prepare(sql).all(...params);
    res.json({ manuals, count: manuals.length });
  });

  // GET /api/manuals/:id — single manual
  router.get('/:id', optionalAuth, (req, res) => {
    const manual = db.prepare(`
      SELECT m.*, c.name AS category_name, s.name AS subject_name, a.full_name AS uploader_name
        FROM manuals m
        LEFT JOIN categories c ON m.category_id = c.id
        LEFT JOIN subjects   s ON m.subject_id  = s.id
        LEFT JOIN admins     a ON m.uploaded_by = a.id
       WHERE m.id = ?
    `).get(req.params.id);
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    if (!manual.is_public && !req.admin) {
      return res.status(403).json({ error: 'This manual is private — please log in' });
    }
    res.json({ manual });
  });

  // GET /api/manuals/:id/view — serve PDF inline for browser viewing (no download count)
  router.get('/:id/view', optionalAuth, (req, res) => {
    const manual = db.prepare('SELECT * FROM manuals WHERE id = ?').get(req.params.id);
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    if (!manual.is_public && !req.admin) {
      return res.status(403).send('This manual is private — please log in to view it.');
    }

    if (manual.file_type !== 'pdf') {
      return res.status(415).send('Only PDF files can be viewed inline.');
    }

    const filePath = path.join(UPLOAD_DIR, manual.file_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('PDF stream error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to read file' });
    });
    stream.pipe(res);
  });

  // GET /api/manuals/:id/download — stream the file as attachment
  router.get('/:id/download', optionalAuth, (req, res) => {
    const manual = db.prepare('SELECT * FROM manuals WHERE id = ?').get(req.params.id);
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    if (!manual.is_public && !req.admin) {
      return res.status(403).send('This manual is private — please log in to download.');
    }

    const filePath = path.join(UPLOAD_DIR, manual.file_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on server' });

    db.prepare('UPDATE manuals SET download_count = download_count + 1 WHERE id = ?').run(manual.id);
    res.download(filePath, manual.original_name);
  });

  // POST /api/manuals — upload (admin/teacher/super_admin)
  router.post('/', authenticate, requireContentManager, upload.single('file'), (req, res) => {
    try {
      const { title, description, subject, semester, subject_id, category_id, department, is_public } = req.body;

      if (!title || !req.file) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Title and file are required' });
      }

      const dept = normaliseDepartment(department);

      const result = db.prepare(`
        INSERT INTO manuals
          (title, description, subject, subject_id, semester, department,
           category_id, file_name, original_name, file_size, file_type,
           is_public, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description || '',
        subject || '',
        subject_id || null,
        semester || '',
        dept,
        category_id || null,
        req.file.filename,
        req.file.originalname,
        req.file.size,
        path.extname(req.file.originalname).slice(1).toLowerCase(),
        toBoolInt(is_public, 1),
        req.admin.id
      );

      db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
        .run(req.admin.id, 'UPLOAD', `Uploaded manual: ${title}`);

      res.json({ success: true, id: result.lastInsertRowid, message: 'Manual uploaded successfully' });
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error(err);
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });

  // PUT /api/manuals/:id — edit metadata
  router.put('/:id', authenticate, requireContentManager, (req, res) => {
    const { title, description, subject, subject_id, semester, department, category_id, is_public } = req.body;
    const manual = db.prepare('SELECT * FROM manuals WHERE id = ?').get(req.params.id);
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    db.prepare(`
      UPDATE manuals
         SET title       = ?,
             description = ?,
             subject     = ?,
             subject_id  = ?,
             semester    = ?,
             department  = ?,
             category_id = ?,
             is_public   = ?,
             updated_at  = CURRENT_TIMESTAMP
       WHERE id = ?
    `).run(
      title       ?? manual.title,
      description ?? manual.description,
      subject     ?? manual.subject,
      subject_id  ?? manual.subject_id,
      semester    ?? manual.semester,
      department ? normaliseDepartment(department) : manual.department,
      category_id ?? manual.category_id,
      is_public !== undefined ? toBoolInt(is_public, manual.is_public) : manual.is_public,
      req.params.id
    );

    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'UPDATE', `Updated manual: ${title || manual.title}`);

    res.json({ success: true, message: 'Manual updated successfully' });
  });

  // PATCH /api/manuals/:id/visibility — quick public/private toggle
  router.patch('/:id/visibility', authenticate, requireContentManager, (req, res) => {
    const { is_public } = req.body;
    const manual = db.prepare('SELECT * FROM manuals WHERE id = ?').get(req.params.id);
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    const newVal = toBoolInt(is_public, manual.is_public);
    db.prepare('UPDATE manuals SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newVal, req.params.id);

    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'VISIBILITY', `Set "${manual.title}" to ${newVal ? 'PUBLIC' : 'PRIVATE'}`);

    res.json({ success: true, is_public: newVal });
  });

  // DELETE /api/manuals/:id
  router.delete('/:id', authenticate, requireContentManager, (req, res) => {
    const manual = db.prepare('SELECT * FROM manuals WHERE id = ?').get(req.params.id);
    if (!manual) return res.status(404).json({ error: 'Manual not found' });

    const filePath = path.join(UPLOAD_DIR, manual.file_name);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.error('Failed to remove file:', e); }
    }
    db.prepare('DELETE FROM manuals WHERE id = ?').run(req.params.id);
    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'DELETE', `Deleted manual: ${manual.title}`);

    res.json({ success: true, message: 'Manual deleted' });
  });

  return router;
};

// Helpers
function toBoolInt(v, fallback) {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'on')   return 1;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === '')   return 0;
  return fallback;
}
