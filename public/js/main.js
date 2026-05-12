/* main.js — shared header/footer + helpers + per-user scope (department + semester).
 *
 * Logos are loaded from /images/tu-logo.jpeg and /images/ugc-logo.jpeg.
 * If those files are missing, a styled "TU" / "UGC" placeholder is shown instead.
 */

const SITE = {
  name: 'Department of Automobile and Mechanical Engineering',
  shortName: 'Auto. & Mech. Engg.',
  campus: 'Thapathali Campus',
  university: 'Tribhuvan University'
};

/* ----- Local scope ----------------------------------------------------- */
function getScope() {
  return {
    department: localStorage.getItem('scope_department') || '',
    semester:   localStorage.getItem('scope_semester')   || ''
  };
}
function setScope(department, semester) {
  if (department !== undefined) localStorage.setItem('scope_department', department);
  if (semester   !== undefined) localStorage.setItem('scope_semester',   semester);
}

/* ----- Logo with image fallback ---------------------------------------- */
function tuLogoHtml() {
  return `<img class="brand-logo" src="/images/tu-logo.jpeg" alt="Tribhuvan University"
            onerror="this.outerHTML='<div class=&quot;brand-logo placeholder&quot;>TU</div>'" />`;
}
function ugcLogoHtml() {
  return `<img src="/images/ugc-logo.jpeg" alt="UGC Nepal"
            onerror="this.outerHTML='<div class=&quot;accreditation-badge&quot;>UGC</div>'" />`;
}

/* ----- Header / footer markup ----------------------------------------- */
function buildHeader(activePage = '') {
  return `
    <div class="header-main">
      <div class="container">
        <a href="/" class="brand" style="text-decoration:none;">
          ${tuLogoHtml()}
          <div class="brand-text">
            <span class="uni">Tribhuvan University</span>
            <h1>Department of Automobile And Mechanical Engineering</h1>
            <span class="campus">Thapathali Campus</span>
          </div>
        </a>
        <div class="accreditation">
          ${ugcLogoHtml()}
          <div class="accreditation-text">
            <strong>Accredited by University Grants Commission</strong>
            <span class="small">(UGC) Nepal</span>
            <span class="small">Quality Education Since 1930 A.D.</span>
          </div>
        </div>
      </div>
    </div>

    <nav class="main-nav">
      <div class="container nav-container">
        <button class="nav-toggle" id="navToggle" aria-label="Toggle navigation" onclick="toggleNav(this)">
          ☰ Menu
        </button>
        <ul class="nav-list">
          <li><a href="/"        class="${activePage === 'home'    ? 'active' : ''}">Home</a></li>
          <li><a href="/about"   class="${activePage === 'about'   ? 'active' : ''}">About</a></li>
          <li><a href="/manuals" class="${activePage === 'manuals' ? 'active' : ''}">Lab Manuals</a></li>
          <li><a href="/notes"   class="${activePage === 'notes'   ? 'active' : ''}">Notes</a></li>
          <li><a href="/notes#submit">Submit Notes</a></li>
          <li><a href="http://tcioe.edu.np" target="_blank" rel="noopener">Main Campus</a></li>
          <li><a href="/login"   class="${activePage === 'login'   ? 'active' : ''}">Login</a></li>
        </ul>
      </div>
    </nav>

    ${buildScopeBar(activePage)}
  `;
}

function buildScopeBar(activePage) {
  // Scope bar only appears on the resource-listing pages, not on home.
  if (!['manuals', 'notes'].includes(activePage)) return '';
  const scope = getScope();
  const semesters = [
    '1st Semester','2nd Semester','3rd Semester','4th Semester',
    '5th Semester','6th Semester','7th Semester','8th Semester'
  ];
  return `
    <div class="scope-bar">
      <div class="container">
        <label>Show resources for</label>
        <select id="scopeDept">
          <option value="" ${!scope.department ? 'selected' : ''}>All Departments</option>
        </select>
        <select id="scopeSem">
          <option value="">All Semesters</option>
          ${semesters.map(s => `<option value="${s}" ${scope.semester === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span class="hint">Filters lab manuals and notes by your department and semester</span>
      </div>
    </div>
  `;
}

// Populate the scope dept dropdown dynamically from the API.
async function loadScopeDepartments() {
  const sel = document.getElementById('scopeDept');
  if (!sel) return;
  try {
    const res = await fetch('/api/admin/departments');
    const data = await res.json();
    const scope = getScope();
    sel.innerHTML = `<option value="" ${!scope.department ? 'selected' : ''}>All Departments</option>` +
      data.departments.map(d => `<option value="${d.code}" ${scope.department === d.code ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
  } catch (_) { /* leave the static option */ }
}

function buildFooter() {
  return `
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="logo-row">
            ${tuLogoHtml().replace('class="brand-logo"', 'class="brand-logo" style="width:40px;height:40px;"')}
            <h4>Department of Automobile<br>And Mechanical Engineering</h4>
          </div>
          <p>This department fosters excellence in teaching, research, and innovation, preparing students for successful careers in applied sciences.</p>
        </div>
        <div class="footer-col">
          <h4>Quick Access</h4>
          <ul>
            <li><a href="/about">About</a></li>
            <li><a href="/manuals">Lab Manuals</a></li>
            <li><a href="/notes">Notes</a></li>
            <li><a href="/notes#submit">Submit Notes</a></li>
            <li><a href="/login">Login</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="https://lms.tcioe.edu.np"     target="_blank" rel="noopener">LMS</a></li>
            <li><a href="https://routine.tcioe.edu.np" target="_blank" rel="noopener">Routine</a></li>
            <li><a href="https://library.tcioe.edu.np" target="_blank" rel="noopener">Library</a></li>
            <li><a href="http://tcioe.edu.np/notices"  target="_blank" rel="noopener">Notices</a></li>
            <li><a href="http://tcioe.edu.np"          target="_blank" rel="noopener">Main Campus Site</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Get In Touch</h4>
          <div class="contact-line"><span class="ic">Email</span><span>doame@tcioe.edu.np</span></div>
          <div class="contact-line"><span class="ic">Phone</span><span>+977-1-5971483</span></div>
          <div class="contact-line"><span class="ic">Address</span><span>Thapathali Campus, Kathmandu</span></div>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Thapathali Campus — Department of Automobile And Mechanical Engineering</span>
        <span class="footer-status"><span class="dot"></span>System Online</span>
      </div>
    </div>
  `;
}

/* ----- Mobile nav ------------------------------------------------------ */
function toggleNav(btn) {
  const list = document.querySelector('.nav-list');
  if (!list) return;
  const isOpen = list.classList.toggle('open');
  btn.classList.toggle('open', isOpen);
  btn.textContent = isOpen ? '✕ Close' : '☰ Menu';
}
window.toggleNav = toggleNav;

/* ----- Bootstrap ------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const headerEl = document.getElementById('site-header');
  const footerEl = document.getElementById('site-footer');
  if (headerEl) headerEl.innerHTML = buildHeader(headerEl.dataset.page || '');
  if (footerEl) footerEl.innerHTML = buildFooter();

  // Close mobile nav when any nav link is clicked.
  document.querySelector('.nav-list')?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      const list = document.querySelector('.nav-list');
      const btn  = document.getElementById('navToggle');
      if (list) list.classList.remove('open');
      if (btn)  { btn.classList.remove('open'); btn.textContent = '☰ Menu'; }
    });
  });

  loadScopeDepartments();
  const dept = document.getElementById('scopeDept');
  const sem  = document.getElementById('scopeSem');
  if (dept) dept.addEventListener('change', () => {
    setScope(dept.value, undefined);
    document.dispatchEvent(new CustomEvent('scopechange', { detail: getScope() }));
  });
  if (sem)  sem.addEventListener('change',  () => {
    setScope(undefined, sem.value);
    document.dispatchEvent(new CustomEvent('scopechange', { detail: getScope() }));
  });
});

/* ----- Helpers --------------------------------------------------------- */
function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}
// Returns a short uppercase label for the file type, used inside a
// styled pill (no emoji icons).
function fileIcon(type) {
  return (type || 'FILE').toString().toUpperCase();
}

// Department dropdown options are populated dynamically from the API,
// but for legacy data the label cache below maps known codes to names.
const _deptLabelCache = { automobile: 'Automobile', mechanical: 'Mechanical', both: 'All Departments' };
function deptLabel(d) {
  if (!d) return '';
  if (_deptLabelCache[d]) return _deptLabelCache[d];
  // capitalise the slug as a fallback (e.g. "civil" -> "Civil")
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function setDeptLabel(code, name) {
  if (code && name) _deptLabelCache[code] = name;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}
function showAlert(container, type, message) {
  if (!container) return;
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = message;
  container.prepend(div);
  setTimeout(() => div.remove(), 5000);
}

window.SITE         = SITE;
window.getScope     = getScope;
window.setScope     = setScope;
window.formatDate   = formatDate;
window.formatBytes  = formatBytes;
window.fileIcon     = fileIcon;
window.deptLabel    = deptLabel;
window.setDeptLabel = setDeptLabel;
window.escapeHtml   = escapeHtml;
window.showAlert    = showAlert;
