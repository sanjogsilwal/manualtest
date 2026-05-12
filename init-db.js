// init-db.js — Initialize the SQLite database with the full schema for
// the Campus Study Hub manuals & notes platform.
//
// Tables: users (admins/teachers/super_admins), departments, categories,
// subjects, manuals, student_notes, activity_log, login_log.
//
// Two super-admins are seeded automatically: Sanjog Silwal and Dipendra Kafle.
// Only super-admins are allowed to create new teachers / admins.
//
// Note: there is no "student" account/role. Students browse the site
// anonymously and may submit notes for review without logging in.

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.db'));

console.log('Initializing database...');

// ---- Schema ---------------------------------------------------------------

// `admins` table is the unified users table (kept under this name for
// backwards compatibility with earlier copies of the DB).
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin',
    department    TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.find(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
addColumnIfMissing('admins', 'department', 'department TEXT');
addColumnIfMissing('admins', 'is_active',  'is_active INTEGER NOT NULL DEFAULT 1');

db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    code        TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS subjects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    code        TEXT,
    department  TEXT NOT NULL DEFAULT 'both',
    semester    TEXT NOT NULL,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, department, semester)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS manuals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    department      TEXT NOT NULL DEFAULT 'both',
    semester        TEXT,
    subject         TEXT,
    subject_id      INTEGER,
    category_id     INTEGER,
    file_name       TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    file_size       INTEGER,
    file_type       TEXT,
    is_public       INTEGER NOT NULL DEFAULT 1,
    download_count  INTEGER NOT NULL DEFAULT 0,
    uploaded_by     INTEGER,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (subject_id)  REFERENCES subjects(id)   ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES admins(id)     ON DELETE SET NULL
  );
`);
addColumnIfMissing('manuals', 'department', "department TEXT NOT NULL DEFAULT 'both'");
addColumnIfMissing('manuals', 'subject_id', 'subject_id INTEGER');

db.exec(`
  CREATE TABLE IF NOT EXISTS student_notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    department      TEXT NOT NULL,
    semester        TEXT NOT NULL,
    subject         TEXT,
    subject_id      INTEGER,
    file_name       TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    file_size       INTEGER,
    file_type       TEXT,
    submitted_by    TEXT NOT NULL,
    submitted_email TEXT,
    submitter_id    INTEGER,
    status          TEXT NOT NULL DEFAULT 'pending',
    reviewed_by     INTEGER,
    reviewed_at     DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id)   REFERENCES subjects(id) ON DELETE SET NULL,
    FOREIGN KEY (submitter_id) REFERENCES admins(id)   ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by)  REFERENCES admins(id)   ON DELETE SET NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER,
    action     TEXT NOT NULL,
    details    TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
  );
`);

// Dedicated login/logout audit log. Only admin and teacher actions are
// recorded here; super_admin logins/logouts are intentionally NOT tracked.
db.exec(`
  CREATE TABLE IF NOT EXISTS login_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    username    TEXT NOT NULL,
    full_name   TEXT,
    role        TEXT NOT NULL,
    action      TEXT NOT NULL,            -- LOGIN | LOGOUT
    ip_address  TEXT,
    user_agent  TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admins(id) ON DELETE SET NULL
  );
`);

// ---- Seed: super admins ---------------------------------------------------

const superAdmins = [
  { username: 'dipendra', email: 'dipendra.kafle@tcioe.edu.np', full_name: 'Dipendra Kafle',  password: 'dipendra123' },
  { username: 'sanjog',   email: 'sanjog.silwal@tcioe.edu.np',  full_name: 'Sanjog Silwal',   password: 'sanjog123'   }
];
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO admins (username, email, password_hash, full_name, role)
  VALUES (?, ?, ?, ?, 'super_admin')
`);
superAdmins.forEach(a => {
  const hash = bcrypt.hashSync(a.password, 10);
  const r = insertUser.run(a.username, a.email, hash, a.full_name);
  if (r.changes) console.log(`  Created super-admin ${a.username} (password: ${a.password})`);
});
const promote = db.prepare(`UPDATE admins SET role = 'super_admin' WHERE username = ?`);
superAdmins.forEach(a => promote.run(a.username));

// Migrate legacy 'student' rows to 'admin' (we no longer use that role).
db.exec(`UPDATE admins SET role = 'admin' WHERE role = 'student'`);

// Legacy default admin (kept for first-time bootstrapping).
const legacy = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!legacy) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO admins (username, email, password_hash, full_name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin', 'admin@tcioe.edu.np', hash, 'System Administrator', 'admin');
  console.log('  Default admin account created (admin / admin123) - change after first login.');
}

// ---- Seed: departments ---------------------------------------------------

const deptCount = db.prepare('SELECT COUNT(*) AS c FROM departments').get().c;
if (deptCount === 0) {
  const insDept = db.prepare(
    'INSERT OR IGNORE INTO departments (name, code, description) VALUES (?, ?, ?)'
  );
  insDept.run('Automobile Engineering', 'automobile', 'Department of Automobile Engineering');
  insDept.run('Mechanical Engineering', 'mechanical', 'Department of Mechanical Engineering');
  console.log('  Default departments seeded (Automobile, Mechanical)');
}

// ---- Seed: categories -----------------------------------------------------

const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
if (catCount === 0) {
  const defaults = [
    ['Lab Manual',         'Step-by-step laboratory experiment guides'],
    ['Tutorial Sheet',     'Class tutorials, problem sheets, worked examples'],
    ['Lecture Notes',      'Course notes prepared by faculty'],
    ['Reference Material', 'Textbook excerpts, standards, datasheets'],
    ['Project / Report',   'Student project reports and templates']
  ];
  const ins = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  defaults.forEach(([n, d]) => ins.run(n, d));
  console.log(`  ${defaults.length} default categories created`);
}

// ---- Seed: subjects -------------------------------------------------------
// Small starter set — admins/teachers add the rest from the admin panel.

const subCount = db.prepare('SELECT COUNT(*) AS c FROM subjects').get().c;
if (subCount === 0) {
  const defaults = [
    { name: 'Engineering Mathematics I',  code: 'SH 401', department: 'both',       semester: '1st Semester' },
    { name: 'Engineering Drawing I',      code: 'ME 401', department: 'both',       semester: '1st Semester' },
    { name: 'Workshop Technology',        code: 'ME 411', department: 'both',       semester: '2nd Semester' },
    { name: 'Engineering Mathematics II', code: 'SH 402', department: 'both',       semester: '2nd Semester' },
    { name: 'Thermodynamics',             code: 'ME 501', department: 'both',       semester: '3rd Semester' },
    { name: 'Strength of Materials',      code: 'ME 502', department: 'both',       semester: '3rd Semester' },
    { name: 'Fluid Mechanics',            code: 'ME 601', department: 'both',       semester: '4th Semester' },
    { name: 'Manufacturing Processes',    code: 'ME 602', department: 'both',       semester: '4th Semester' },
    { name: 'Heat Transfer',              code: 'ME 701', department: 'mechanical', semester: '5th Semester' },
    { name: 'Machine Design I',           code: 'ME 702', department: 'mechanical', semester: '6th Semester' },
    { name: 'Refrigeration & AC',         code: 'ME 705', department: 'mechanical', semester: '7th Semester' },
    { name: 'Power Plant Engineering',    code: 'ME 706', department: 'mechanical', semester: '7th Semester' },
    { name: 'IC Engines',                 code: 'AU 701', department: 'automobile', semester: '5th Semester' },
    { name: 'Automotive Chassis',         code: 'AU 702', department: 'automobile', semester: '6th Semester' },
    { name: 'Automotive Electrical',      code: 'AU 703', department: 'automobile', semester: '7th Semester' },
    { name: 'Vehicle Dynamics',           code: 'AU 704', department: 'automobile', semester: '8th Semester' }
  ];
  const ins = db.prepare(
    'INSERT OR IGNORE INTO subjects (name, code, department, semester) VALUES (?, ?, ?, ?)'
  );
  defaults.forEach(s => ins.run(s.name, s.code, s.department, s.semester));
  console.log(`  ${defaults.length} default subjects created`);
}

console.log('Database initialized successfully at database.db');
db.close();
