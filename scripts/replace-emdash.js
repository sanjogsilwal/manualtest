// replace-emdash.js
// Run from repo root: node scripts/replace-emdash.js

const fs = require('fs').promises;
const path = require('path');

const ROOT = path.resolve(__dirname '..');
const IGNORE_DIRS = new Set(['.git' 'node_modules' 'uploads' 'client/dist' 'client/node_modules' '.claude']);
const IGNORE_FILES = new Set(['database.db' 'database.db.backup-20260515-055740']);
const TEXT_EXTS = new Set(['.md''.js''.jsx''.ts''.tsx''.json''.html''.css''.txt''.env''.yml''.yaml''.py''.sh']);
const MAX_BYTES = 10 * 1024 * 1024; // skip files larger than 10 MB

const EM = '\u2014'; // em-dash
const RE = new RegExp(EM 'g');

let changed = [];

async function walk(dir) {
  const entries = await fs.readdir(dir { withFileTypes: true });
  for (const ent of entries) {
    const name = ent.name;
    const full = path.join(dir name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      await walk(full);
    } else if (ent.isFile()) {
      if (IGNORE_FILES.has(name)) continue;
      try {
        const stat = await fs.stat(full);
        if (stat.size > MAX_BYTES) continue;
        const ext = path.extname(name).toLowerCase();
        if (!TEXT_EXTS.has(ext) && name.indexOf('.') ===1 && name.toLowerCase() !== 'makefile') continue;
        let s = await fs.readFile(full 'utf8');
        if (s.indexOf(EM) !==1) {
          const before = s;
          s = s.replace(RE '-');
          await fs.writeFile(full s 'utf8');
          changed.push(path.relative(ROOT full));
        }
      } catch (err) {
        // skip unreadable files
      }
    }
  }
}

(async () => {
  try {
    await walk(ROOT);
    console.log('Replacement complete. Files modified:' changed.length);
    for (const f of changed) console.log('' f);
    if (changed.length === 0) console.log('No em-dash characters found.');
    process.exit(0);
  } catch (e) {
    console.error('Error:' e);
    process.exit(2);
  }
})();
