// remove-department.js
// Run: node scripts/remove-department.js
const fs = require('fs').promises;
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'uploads']);
const VARIANTS = [
  '',
  '',
  ',',
  ' —',
  ' -',
  ''
];
let changed = [];
async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const name = ent.name;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      await walk(full);
    } else if (ent.isFile()) {
      try {
        const stat = await fs.stat(full);
        if (stat.size > 12 * 1024 * 1024) continue;
        let s = await fs.readFile(full, 'utf8');
        let modified = false;
        for (const v of VARIANTS) {
            if (s.includes(v)) {
              s = s.split(v).join('');
              modified = true;
            }
          }
          // remove split occurrences where a <br> or newline separates the two parts
          const splitRegex = /Department of Automobile\s*(?:<br\s*\/?\>|\\n|\\r\\n|\\s)*\s*(?:And|&amp;|&)\s*Mechanical Engineering/ig;
          if (splitRegex.test(s)) {
            s = s.replace(splitRegex, '');
            modified = true;
          }
          // catch minified/bundled split strings like: "Department of Automobile",l.jsx("br",{}),"And Mechanical Engineering"
          const bundleSplitRegex = /Department of Automobile[\s\S]{0,400}?And Mechanical Engineering/ig;
          if (bundleSplitRegex.test(s)) {
            s = s.replace(bundleSplitRegex, '');
            modified = true;
          }
        if (modified) {
          await fs.writeFile(full, s, 'utf8');
          changed.push(path.relative(ROOT, full));
        }
      } catch (e) {
        // skip
      }
    }
  }
}
(async ()=>{
  await walk(ROOT);
  console.log('Done. Files modified:', changed.length);
  changed.forEach(f=>console.log(' -', f));
})();
