// One-time migration: remove the "both" department from the subjects table.
//
// For every subject with department='both', we keep the existing row
// (so manuals.subject_id references stay valid) and re-point it to
// 'automobile', then create a twin row for 'mechanical'. This preserves
// the original "applies to both depts" intent as two separate real rows.
//
// Run with:  node migrate-remove-both.js
//   (stop the dev server first so SQLite isn't locked)

const fs   = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH     = path.join(__dirname, 'database.db');
const BACKUP_PATH = path.join(__dirname, `database.db.backup-${new Date().toISOString().replace(/[:.]/g, '-')}`);

if (!fs.existsSync(DB_PATH)) {
  console.error('database.db not found. Run npm run init-db first.');
  process.exit(1);
}

fs.copyFileSync(DB_PATH, BACKUP_PATH);
console.log('Backup written:', BACKUP_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const both = db.prepare("SELECT * FROM subjects WHERE department = 'both'").all();
console.log(`Found ${both.length} subjects with department='both'.`);

const repoint = db.prepare("UPDATE subjects SET department = 'automobile' WHERE id = ?");
const insertTwin = db.prepare(
  "INSERT INTO subjects (name, code, department, semester, description) VALUES (?, ?, 'mechanical', ?, ?)"
);

let twinsCreated = 0, twinsSkipped = 0;
const tx = db.transaction(() => {
  for (const s of both) {
    repoint.run(s.id);
    try {
      insertTwin.run(s.name, s.code, s.semester, s.description);
      twinsCreated++;
    } catch (err) {
      // UNIQUE(name, department, semester) — a mechanical row with the same
      // name+semester already exists, so skip silently.
      if (String(err.message).includes('UNIQUE')) {
        twinsSkipped++;
      } else {
        throw err;
      }
    }
  }
  // Defensive: also clean up any other tables with department='both'
  db.prepare("UPDATE manuals       SET department = 'automobile' WHERE department = 'both'").run();
  db.prepare("UPDATE student_notes SET department = 'automobile' WHERE department = 'both'").run();
});
tx();

console.log(`Repointed ${both.length} subject(s) to 'automobile'.`);
console.log(`Created ${twinsCreated} mechanical twin(s); skipped ${twinsSkipped} that already existed.`);

console.log('\nFinal department counts:');
for (const t of ['subjects', 'manuals', 'student_notes']) {
  const rows = db.prepare(`SELECT department, COUNT(*) AS c FROM ${t} GROUP BY department`).all();
  console.log(` ${t}:`, rows.map(r => `${r.department || '<null>'}=${r.c}`).join(', ') || '(empty)');
  const stillBoth = db.prepare(`SELECT COUNT(*) AS c FROM ${t} WHERE department = 'both'`).get().c;
  if (stillBoth > 0) console.warn(`  ! ${t} still has ${stillBoth} row(s) with 'both'`);
}

db.close();
console.log('\nDone. You can delete the backup once you have verified the change.');
