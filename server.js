// server.js — Main entry point for the Manual / Notes Management System.
require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');
const fs           = require('fs');
const Database     = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Database -----------------------------------------------------------
const dbPath = path.join(__dirname, 'database.db');
if (!fs.existsSync(dbPath)) {
  console.log('Database not found. Please run: npm run init-db');
  process.exit(1);
}
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---- Middleware --------------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ---- Static ------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

// ---- API Routes --------------------------------------------------------
app.use('/api/auth',     require('./routes/auth')(db));
app.use('/api/manuals',  require('./routes/manuals')(db));
app.use('/api/admin',    require('./routes/admin')(db));
app.use('/api/subjects', require('./routes/subjects')(db));
app.use('/api/notes',    require('./routes/notes')(db));

// ---- Page routes (clean URLs) -----------------------------------------
const pages = [
  ['/',        'index.html'],
  ['/manuals', 'manuals.html'],
  ['/notes',   'notes.html'],
  ['/about',   'about.html'],
  ['/login',   'login.html'],
  ['/admin',   'admin.html']
];
pages.forEach(([url, file]) =>
  app.get(url, (req, res) => res.sendFile(path.join(__dirname, 'public', file)))
);

// ---- 404 ---------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API endpoint not found' });
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ---- Error handler -----------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ---- Start -------------------------------------------------------------
app.listen(PORT, () => {
  console.log('\n┌─────────────────────────────────────────────────────────┐');
  console.log('│  Lab Manual & Notes Management System                   │');
  console.log('│  Department of Automobile and Mechanical Engineering    │');
  console.log('│  IOE, Thapathali Campus                                 │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│  Site:      http://localhost:${PORT}`);
  console.log(`│  Login:     http://localhost:${PORT}/login`);
  console.log(`│  Admin:     http://localhost:${PORT}/admin`);
  console.log('└─────────────────────────────────────────────────────────┘\n');
});

process.on('SIGINT', () => { console.log('\nShutting down...'); db.close(); process.exit(0); });
