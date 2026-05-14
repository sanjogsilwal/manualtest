// routes/subjects.js — CRUD for subjects (admins/teachers manage them).
//
// A subject belongs to:
//   - department: any department.code from the `departments` table, OR 'both'
//   - semester:   "1st Semester" … "8th Semester"
//
// Subjects are returned sorted by department then semester then name so
// callers can group them by department in the UI.

const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const { authenticate, requireContentManager } = require('../middleware/auth');

const SEM_ORDER = [
  '1st Semester','2nd Semester','3rd Semester','4th Semester',
  '5th Semester','6th Semester','7th Semester','8th Semester'
];

function normalizeSemester(raw) {
  const s = String(raw).trim();
  const canon = SEM_ORDER.find(x => x.toLowerCase() === s.toLowerCase());
  if (canon) return canon;
  const m1 = s.match(/^(\d+)(st|nd|rd|th)$/i);
  if (m1) return SEM_ORDER[parseInt(m1[1]) - 1] || null;
  const m2 = s.match(/(?:semester|sem)\s*(\d+)/i);
  if (m2) return SEM_ORDER[parseInt(m2[1]) - 1] || null;
  const m3 = s.match(/^(\d+)$/);
  if (m3) return SEM_ORDER[parseInt(m3[1]) - 1] || null;
  return null;
}

// Normalize "Year" column: "1", "1st", "1st Year", "Year 1" → integer 1-4
function normalizeYear(raw) {
  const s = String(raw).trim();
  const m1 = s.match(/^(\d+)/);
  if (m1) {
    const n = parseInt(m1[1]);
    return n >= 1 && n <= 4 ? n : null;
  }
  const words = { first: 1, second: 2, third: 3, fourth: 4 };
  const lower = s.toLowerCase().replace(/\s+year$/,'').trim();
  return words[lower] || null;
}

// Normalize "Part" column: "I","1","Part I","Part 1","i" → integer 1 or 2
function normalizePart(raw) {
  const s = String(raw).trim().toLowerCase().replace(/^part\s*/i,'');
  if (s === 'i' || s === '1') return 1;
  if (s === 'ii' || s === '2') return 2;
  return null;
}

// Convert Year + Part to canonical semester string
function yearPartToSemester(year, part) {
  const idx = (year - 1) * 2 + (part - 1);
  return SEM_ORDER[idx] || null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only .xlsx, .xls, or .csv files are allowed'), ok);
  }
});

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
    sql += sort === 'name'
      ? ' ORDER BY s.name'
      : ' ORDER BY s.department, s.semester, s.name';
    res.json({ subjects: db.prepare(sql).all(...params) });
  });

  // GET /api/subjects/import/template — download a blank Excel template
  router.get('/import/template', authenticate, requireContentManager, (_req, res) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['Year', 'Part', 'Subject Code', 'Subject Name'],
      [1, 'I',  'SH 401', 'Engineering Mathematics I'],
      [1, 'II', 'SH 402', 'Engineering Physics'],
      [2, 'I',  'ME 501', 'Thermodynamics'],
      [2, 'II', 'ME 502', 'Fluid Mechanics'],
      [3, 'I',  'ME 601', 'Heat Transfer'],
      [3, 'II', 'ME 602', 'Machine Design'],
      [4, 'I',  'ME 701', 'Industrial Engineering'],
      [4, 'II', 'ME 702', 'Project Work'],
    ]);
    ws['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="subjects_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  });

  // POST /api/subjects/import — bulk import subjects from Excel/CSV
  router.post('/import', authenticate, requireContentManager, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const valid = knownDepartmentCodes();
    const dept  = valid.has(req.body.department) ? req.body.department : 'both';

    let rows;
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } catch (err) {
      return res.status(400).json({ error: 'Could not parse file: ' + err.message });
    }

    if (!rows.length) return res.status(400).json({ error: 'The file has no data rows.' });

    const insertSubject = db.prepare(`
      INSERT OR IGNORE INTO subjects (name, code, department, semester, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    let added = 0, skipped = 0;
    const errors = [];

    for (const [i, row] of rows.entries()) {
      const rowNum = i + 2;
      const keys   = Object.keys(row);
      const get    = (...names) => {
        for (const n of names) {
          const k = keys.find(k => k.trim().toLowerCase() === n.toLowerCase());
          if (k !== undefined) return String(row[k]).trim();
        }
        return '';
      };

      const name        = get('subject name', 'subject', 'name');
      const code        = get('subject code', 'code', 'course code');
      const description = get('description', 'desc');

      if (!name) { errors.push(`Row ${rowNum}: missing subject name`); continue; }

      // Prefer Year + Part columns; fall back to a Semester column
      let semester = null;
      const rawYear = get('year');
      const rawPart = get('part', 'part/semester', 'semester');
      if (rawYear) {
        const year = normalizeYear(rawYear);
        const part = normalizePart(rawPart);
        if (!year) { errors.push(`Row ${rowNum}: unrecognized year "${rawYear}" — use 1, 2, 3, or 4`); continue; }
        if (!part) { errors.push(`Row ${rowNum}: unrecognized part "${rawPart}" — use I or II`); continue; }
        semester = yearPartToSemester(year, part);
      } else {
        const rawSem = get('semester', 'sem');
        if (!rawSem) { errors.push(`Row ${rowNum}: missing Year or Semester`); continue; }
        semester = normalizeSemester(rawSem);
        if (!semester) {
          errors.push(`Row ${rowNum}: unrecognized semester "${rawSem}"`);
          continue;
        }
      }

      try {
        const r = insertSubject.run(name, code, dept, semester, description);
        if (r.changes > 0) added++;
        else skipped++;
      } catch (err) {
        errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    db.prepare('INSERT INTO activity_log (admin_id, action, details) VALUES (?, ?, ?)')
      .run(req.admin.id, 'SUBJECT_IMPORT',
        `Imported ${added} subjects into "${dept}" (${skipped} duplicates skipped, ${errors.length} errors)`);

    res.json({ success: true, added, skipped, errors: errors.slice(0, 20) });
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
