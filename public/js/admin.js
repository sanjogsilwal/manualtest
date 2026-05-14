/* admin.js — Admin / Teacher / Super-Admin dashboard logic.
 *
 * Departments are loaded once from /api/admin/departments and used to
 * populate every department selector in the UI. Subjects are grouped by
 * department in the Subjects section.
 */

// Surface any uncaught error inside the alert bar so problems don't go silent.
window.addEventListener('error', (e) => {
  const c = document.getElementById('alertContainer');
  if (!c) return;
  c.innerHTML = `<div class="alert alert-error">Script error: ${e.message} (${(e.filename||'').split('/').pop()}:${e.lineno})</div>`;
});
window.addEventListener('unhandledrejection', (e) => {
  const c = document.getElementById('alertContainer');
  if (!c) return;
  c.innerHTML = `<div class="alert alert-error">Promise error: ${e.reason && (e.reason.message || e.reason)}</div>`;
});

const $ = (id) => document.getElementById(id);
let currentUser   = null;
let allCategories = [];
let allSubjects   = [];
let allDepartments = [];
let notesStatusFilter = 'pending';

/* ---------- helpers ---------- */
function showAlert(type, msg, container = $('alertContainer')) {
  if (!container) return;
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = msg;
  container.innerHTML = '';
  container.appendChild(div);
  setTimeout(() => div.remove(), 4500);
}
function openModal(id)  { $(id).classList.add('active'); }
function closeModal(id) { $(id).classList.remove('active'); }

/* ---------- auth bootstrap ---------- */
async function checkAuth() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) {
    console.warn('[admin] /api/auth/me returned', res.status, '- redirecting to /login');
    window.location.href = '/login';
    return;
  }
  const data = await res.json();
  currentUser = data.user || data.admin;
  if (!currentUser) {
    console.error('[admin] /api/auth/me returned no user payload', data);
    window.location.href = '/login';
    return;
  }
  if (!['super_admin', 'admin', 'teacher'].includes(currentUser.role)) {
    console.warn('[admin] role not permitted:', currentUser.role);
    window.location.href = '/';
    return;
  }
  $('adminName').textContent   = currentUser.full_name;
  $('adminRole').textContent   = currentUser.role.replace('_', ' ');
  if (currentUser.role === 'super_admin') {
    $('usersLink').style.display = '';
    $('departmentsLink').style.display = '';
  }
}

$('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  localStorage.removeItem('user_token');
  localStorage.removeItem('user_info');
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_info');
  window.location.href = '/login';
});

/* ---------- sidebar nav ---------- */
document.querySelectorAll('.admin-nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const section = link.dataset.section;
    document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    $(`section-${section}`).classList.add('active');
    window.location.hash = section;

    if (section === 'manuals')     loadAdminManuals();
    if (section === 'departments') loadDepartments();
    if (section === 'subjects')    loadSubjects();
    if (section === 'categories')  loadCategoriesAdmin();
    if (section === 'notes')       loadNotes();
    if (section === 'users')       loadUsers();
    if (section === 'loginlog')    loadLoginLog();
    if (section === 'activity')    loadActivity();
    if (section === 'dashboard')   loadDashboard();
  });
});

/* ---------- departments (shared) ---------- */
async function loadAllDepartments() {
  try {
    const res = await fetch('/api/admin/departments');
    const data = await res.json();
    allDepartments = data.departments;
    allDepartments.forEach(d => setDeptLabel(d.code, d.name));
    populateDeptDropdowns();
  } catch (e) {
    showAlert('error', 'Failed to load departments');
  }
}

function deptOptionsHtml(includeBoth, currentValue) {
  const both = includeBoth
    ? `<option value="both" ${currentValue === 'both' ? 'selected' : ''}>All Departments (Both)</option>`
    : '';
  return both + allDepartments.map(d =>
    `<option value="${d.code}" ${currentValue === d.code ? 'selected' : ''}>${escapeHtml(d.name)}</option>`
  ).join('');
}

function populateDeptDropdowns() {
  // Manuals filter
  const fil = $('adminDeptFilter');
  if (fil) {
    const cur = fil.value;
    fil.innerHTML = '<option value="">All Departments</option>' + deptOptionsHtml(true, cur);
    fil.value = cur;
  }
  // Manual upload modal
  const m = $('manualDepartment');
  if (m) m.innerHTML = deptOptionsHtml(true, m.value || 'both');
  // Subject modal
  const s = $('subjectDepartment');
  if (s) s.innerHTML = deptOptionsHtml(true, s.value || 'both');
  // User modal
  const u = $('userDepartment');
  if (u) {
    const cur = u.value;
    u.innerHTML = '<option value="">—</option>' + deptOptionsHtml(false, cur);
    u.value = cur;
  }
}

/* ---------- dashboard ---------- */
async function loadDashboard() {
  try {
    const res  = await fetch('/api/admin/stats', { credentials: 'include' });
    const data = await res.json();
    const s = data.stats;
    $('ds-manuals').textContent       = s.totalManuals;
    $('ds-public').textContent        = s.publicManuals;
    $('ds-private').textContent       = s.privateManuals;
    $('ds-subjects').textContent      = s.totalSubjects;
    $('ds-notes-pending').textContent = s.pendingNotes;
    $('ds-downloads').textContent     = s.totalDownloads;

    $('recentActivity').innerHTML = data.recentActivity.length === 0
      ? '<p style="color:var(--text-muted);">No activity yet.</p>'
      : data.recentActivity.map(a => `
          <div style="padding:10px 0; border-bottom:1px solid var(--border); font-size:13px;">
            <strong>${escapeHtml(a.full_name || 'System')}</strong>
            <span style="color:var(--text-muted);">— ${escapeHtml(a.action)}</span><br>
            <small style="color:var(--text-light);">${escapeHtml(a.details || '')} • ${formatDate(a.created_at)}</small>
          </div>`).join('');

    $('topDownloaded').innerHTML = data.topDownloaded.length === 0
      ? '<p style="color:var(--text-muted);">No downloads yet.</p>'
      : data.topDownloaded.map(m => `
          <div style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; font-size:13px;">
            <span>${escapeHtml(m.title)}</span>
            <strong style="color:var(--accent-dark);">${m.download_count}</strong>
          </div>`).join('');
  } catch (e) { showAlert('error', 'Failed to load dashboard'); }
}

/* ---------- manuals ---------- */
async function loadAdminManuals() {
  const params = new URLSearchParams();
  const search = $('adminSearchInput').value;
  const cat    = $('adminCategoryFilter').value;
  const dept   = $('adminDeptFilter').value;
  const sem    = $('adminSemFilter').value;
  if (search) params.set('search', search);
  if (cat)    params.set('category', cat);
  if (dept)   params.set('department', dept);
  if (sem)    params.set('semester', sem);

  try {
    const res = await fetch('/api/manuals?' + params.toString(), { credentials: 'include' });
    const data = await res.json();
    const tbody = $('manualsTableBody');
    if (data.manuals.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No manuals found. Click "Upload New Manual" to get started.</td></tr>';
      return;
    }
    tbody.innerHTML = data.manuals.map(m => `
      <tr>
        <td>
          <strong>${escapeHtml(m.title)}</strong>
          ${m.description ? `<br><small style="color:var(--text-muted);">${escapeHtml((m.description||'').slice(0,80))}${m.description.length>80?'…':''}</small>` : ''}
        </td>
        <td><span class="badge">${escapeHtml(deptLabel(m.department) || '—')}</span></td>
        <td>${escapeHtml(m.semester || '—')}</td>
        <td>${escapeHtml(m.subject_name || m.subject || '—')}</td>
        <td>
          <span style="color:var(--text-muted); font-size:12px;">
            ${(m.file_type||'').toUpperCase()}<br>${formatBytes(m.file_size)}
          </span>
        </td>
        <td><strong>${m.download_count}</strong></td>
        <td>
          <label class="toggle">
            <input type="checkbox" ${m.is_public ? 'checked' : ''}
                   onchange="toggleVisibility(${m.id}, this.checked)" />
            <span class="slider"></span>
          </label>
          <div style="font-size:11px; margin-top:4px; color:${m.is_public ? 'var(--success)' : 'var(--warning)'};">
            ${m.is_public ? 'PUBLIC' : 'PRIVATE'}
          </div>
        </td>
        <td>
          <a href="/api/manuals/${m.id}/download" class="btn btn-ghost btn-sm" title="Download">Download</a>
          <button class="btn btn-secondary btn-sm" onclick="editManual(${m.id})">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteManual(${m.id}, ${JSON.stringify(m.title).replace(/"/g,'&quot;')})">Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (e) { showAlert('error', 'Failed to load manuals'); }
}

['adminSearchInput','adminCategoryFilter','adminDeptFilter','adminSemFilter'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('input',  () => { clearTimeout(window._dt); window._dt = setTimeout(loadAdminManuals, 250); });
  el.addEventListener('change', loadAdminManuals);
});

async function toggleVisibility(id, isPublic) {
  try {
    const res = await fetch(`/api/manuals/${id}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ is_public: !!isPublic })
    });
    if (res.ok) { showAlert('success', `Manual is now ${isPublic ? 'PUBLIC' : 'PRIVATE'}`); loadAdminManuals(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed to change visibility'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

async function deleteManual(id, title) {
  if (!confirm(`Delete "${title}"? This permanently removes the file.`)) return;
  try {
    const res = await fetch(`/api/manuals/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Manual deleted'); loadAdminManuals(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed to delete'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

$('btnUpload').addEventListener('click', () => {
  $('manualModalTitle').textContent = 'Upload New Manual';
  $('manualSubmitBtn').textContent  = 'Upload Manual';
  $('manualForm').reset();
  $('manualId').value = '';
  $('fileGroup').style.display = '';
  $('manualFile').required = true;
  $('manualIsPublic').checked = true;
  populateDeptDropdowns();
  $('manualDepartment').value = 'both';
  $('manualSemester').value   = '';
  populateCategorySelect($('manualCategory'));
  populateSubjectSelect($('manualSubjectId'), '', 'both', '');
  openModal('manualModal');
});

async function editManual(id) {
  try {
    const res = await fetch(`/api/manuals/${id}`, { credentials: 'include' });
    const data = await res.json();
    const m = data.manual;
    $('manualModalTitle').textContent = 'Edit Manual';
    $('manualSubmitBtn').textContent  = 'Save Changes';
    $('manualId').value          = m.id;
    $('manualTitle').value        = m.title;
    $('manualDescription').value  = m.description || '';
    $('manualSubject').value      = m.subject || '';
    $('manualSemester').value     = m.semester || '';
    populateDeptDropdowns();
    $('manualDepartment').value   = m.department || 'both';
    populateCategorySelect($('manualCategory'), m.category_id);
    populateSubjectSelect($('manualSubjectId'), m.subject_id, m.department || 'both', m.semester || '');
    $('manualIsPublic').checked   = !!m.is_public;
    $('fileGroup').style.display  = 'none';
    $('manualFile').required      = false;
    openModal('manualModal');
  } catch (e) { showAlert('error', 'Failed to load manual'); }
}

$('manualForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('manualId').value;
  const submitBtn = $('manualSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const payload = {
    title:       $('manualTitle').value.trim(),
    description: $('manualDescription').value,
    subject:     $('manualSubject').value,
    subject_id:  $('manualSubjectId').value || null,
    semester:    $('manualSemester').value,
    department:  $('manualDepartment').value,
    category_id: $('manualCategory').value || null,
    is_public:   $('manualIsPublic').checked
  };
  if (!payload.title) {
    showAlert('error', 'Title is required');
    submitBtn.disabled = false; submitBtn.textContent = id ? 'Save Changes' : 'Upload Manual';
    return;
  }

  try {
    if (id) {
      const res = await fetch(`/api/manuals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const d = await res.json();
      if (res.ok) { showAlert('success', 'Manual updated'); closeModal('manualModal'); loadAdminManuals(); }
      else        { showAlert('error', d.error || 'Update failed'); }
    } else {
      if (!$('manualFile').files[0]) {
        showAlert('error', 'Please choose a file');
        submitBtn.disabled = false; submitBtn.textContent = 'Upload Manual';
        return;
      }
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => fd.append(k, v ?? ''));
      fd.append('file', $('manualFile').files[0]);
      const res = await fetch('/api/manuals', { method: 'POST', credentials: 'include', body: fd });
      const d = await res.json();
      if (res.ok) { showAlert('success', 'Manual uploaded'); closeModal('manualModal'); loadAdminManuals(); }
      else        { showAlert('error', d.error || 'Upload failed'); }
    }
  } catch (e) { showAlert('error', 'Network error'); }
  finally { submitBtn.disabled = false; submitBtn.textContent = id ? 'Save Changes' : 'Upload Manual'; }
});

/* ---------- departments management ---------- */
async function loadDepartments() {
  try {
    const res = await fetch('/api/admin/departments');
    const data = await res.json();
    allDepartments = data.departments;
    allDepartments.forEach(d => setDeptLabel(d.code, d.name));
    populateDeptDropdowns();

    const tbody = $('deptsTableBody');
    tbody.innerHTML = allDepartments.length === 0
      ? '<tr><td colspan="6" style="text-align:center; padding:30px;">No departments yet.</td></tr>'
      : allDepartments.map(d => `
        <tr>
          <td><strong>${escapeHtml(d.name)}</strong></td>
          <td><code>${escapeHtml(d.code)}</code></td>
          <td>${escapeHtml(d.description || '—')}</td>
          <td>${d.subject_count}</td>
          <td>${formatDate(d.created_at)}</td>
          <td>
            ${currentUser.role === 'super_admin' ? `
              <button class="btn btn-secondary btn-sm" onclick='editDepartment(${d.id})'>Edit</button>
              <button class="btn btn-danger btn-sm" onclick='deleteDepartment(${d.id}, ${JSON.stringify(d.name).replace(/"/g,'&quot;')})'>Delete</button>
            ` : '<small style="color:var(--text-muted);">view only</small>'}
          </td>
        </tr>`).join('');
  } catch (e) { showAlert('error', 'Failed to load departments'); }
}

if ($('btnAddDept')) $('btnAddDept').addEventListener('click', () => {
  $('deptModalTitle').textContent = 'Add Department';
  $('deptForm').reset();
  $('deptId').value = '';
  $('deptCode').disabled = false;
  openModal('deptModal');
});

function editDepartment(id) {
  const d = allDepartments.find(x => x.id === id);
  if (!d) return;
  $('deptModalTitle').textContent = 'Edit Department';
  $('deptId').value          = d.id;
  $('deptName').value        = d.name;
  $('deptCode').value        = d.code;
  $('deptCode').disabled     = true;
  $('deptDescription').value = d.description || '';
  openModal('deptModal');
}

async function deleteDepartment(id, name) {
  if (!confirm(`Delete department "${name}"?`)) return;
  try {
    const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Department deleted'); await loadAllDepartments(); loadDepartments(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

if ($('deptForm')) $('deptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id   = $('deptId').value;
  const body = {
    name:        $('deptName').value.trim(),
    code:        $('deptCode').value.trim().toLowerCase(),
    description: $('deptDescription').value
  };
  if (!body.name || !body.code) { showAlert('error', 'Name and code are required'); return; }
  try {
    const res = await fetch(id ? `/api/admin/departments/${id}` : '/api/admin/departments', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const d = await res.json();
    if (res.ok) {
      showAlert('success', id ? 'Department updated' : 'Department created');
      closeModal('deptModal');
      await loadAllDepartments();
      loadDepartments();
    } else { showAlert('error', d.error || 'Failed to save'); }
  } catch (e) { showAlert('error', 'Network error'); }
});

/* ---------- categories ---------- */
async function loadCategoriesAdmin() {
  try {
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    allCategories = data.categories;

    const sel = $('adminCategoryFilter');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">All Categories</option>' +
        allCategories.map(c => `<option value="${c.id}">${escapeHtml(c.name)} (${c.manual_count})</option>`).join('');
      sel.value = cur;
    }

    const tbody = $('categoriesTableBody');
    tbody.innerHTML = allCategories.length === 0
      ? '<tr><td colspan="4" style="text-align:center; padding:30px;">No categories yet.</td></tr>'
      : allCategories.map(c => `
        <tr>
          <td><strong>${escapeHtml(c.name)}</strong></td>
          <td>${escapeHtml(c.description || '—')}</td>
          <td>${c.manual_count}</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick='editCategory(${c.id}, ${JSON.stringify(c.name)}, ${JSON.stringify(c.description||"")})'>Edit</button>
            <button class="btn btn-danger btn-sm" onclick='deleteCategory(${c.id}, ${JSON.stringify(c.name)})'>Delete</button>
          </td>
        </tr>`).join('');
  } catch (e) { showAlert('error', 'Failed to load categories'); }
}

function populateCategorySelect(sel, current = '') {
  sel.innerHTML = '<option value="">— Uncategorized —</option>' +
    allCategories.map(c => `<option value="${c.id}" ${c.id == current ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
}

$('btnAddCategory').addEventListener('click', () => {
  $('categoryModalTitle').textContent = 'Add Category';
  $('categoryForm').reset();
  $('categoryId').value = '';
  openModal('categoryModal');
});

function editCategory(id, name, desc) {
  $('categoryModalTitle').textContent = 'Edit Category';
  $('categoryId').value = id;
  $('categoryName').value = name;
  $('categoryDescription').value = desc;
  openModal('categoryModal');
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"?`)) return;
  try {
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Category deleted'); loadCategoriesAdmin(); }
    else        { showAlert('error', 'Failed to delete'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

$('categoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('categoryId').value;
  const body = { name: $('categoryName').value, description: $('categoryDescription').value };
  try {
    const res = await fetch(id ? `/api/admin/categories/${id}` : '/api/admin/categories', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', id ? 'Category updated' : 'Category created'); closeModal('categoryModal'); loadCategoriesAdmin(); }
    else        { showAlert('error', d.error || 'Failed to save'); }
  } catch (e) { showAlert('error', 'Network error'); }
});

/* ---------- subjects — three-column cascading picker ---------- */
let subjectsDeptSel = '';
let subjectsSemSel  = '';

const SEM_ORDER = ['1st Semester','2nd Semester','3rd Semester','4th Semester',
                   '5th Semester','6th Semester','7th Semester','8th Semester'];

async function loadSubjects() {
  try {
    const res = await fetch('/api/subjects');
    const data = await res.json();
    allSubjects = data.subjects;
    renderSubjectDeptCol();
    renderSubjectSemCol();
    renderSubjectListCol();
  } catch (e) { showAlert('error', 'Failed to load subjects'); }
}

function renderSubjects() {
  renderSubjectDeptCol();
  renderSubjectSemCol();
  renderSubjectListCol();
}

function renderSubjectDeptCol() {
  const col = $('subjectsDeptCol');
  if (!col) return;
  const depts = [...allDepartments, { code: 'both', name: 'Common (Both Depts)' }];
  col.innerHTML = depts.map(d => `
    <div class="subjects-col-item ${subjectsDeptSel === d.code ? 'active' : ''}"
         onclick="selectSubjectDept('${d.code}')">
      ${escapeHtml(d.name)}
    </div>`).join('');
}

function renderSubjectSemCol() {
  const col = $('subjectsSemCol');
  if (!col) return;
  if (!subjectsDeptSel) {
    col.innerHTML = '<div class="subjects-col-hint">Select a department first</div>';
    return;
  }
  const eligible = allSubjects.filter(s =>
    s.department === subjectsDeptSel || s.department === 'both'
  );
  const sems = [...new Set(eligible.map(s => s.semester))]
    .sort((a, b) => SEM_ORDER.indexOf(a) - SEM_ORDER.indexOf(b));
  if (sems.length === 0) {
    col.innerHTML = '<div class="subjects-col-hint">No subjects yet</div>';
    return;
  }
  col.innerHTML = sems.map(sem => `
    <div class="subjects-col-item ${subjectsSemSel === sem ? 'active' : ''}"
         onclick="selectSubjectSem('${escapeHtml(sem)}')">
      ${escapeHtml(sem)}
    </div>`).join('');
}

function renderSubjectListCol() {
  const col    = $('subjectsListCol');
  const header = $('subjectsColHeader');
  if (!col) return;
  if (!subjectsDeptSel) {
    if (header) header.textContent = 'Subjects';
    col.innerHTML = '<div class="subjects-col-hint">Select a department and semester</div>';
    return;
  }
  if (!subjectsSemSel) {
    if (header) header.textContent = 'Subjects';
    col.innerHTML = '<div class="subjects-col-hint">Select a semester</div>';
    return;
  }
  const list = allSubjects.filter(s =>
    (s.department === subjectsDeptSel || s.department === 'both') &&
    s.semester === subjectsSemSel
  );
  if (header) header.textContent = `Subjects — ${subjectsSemSel} (${list.length})`;
  if (list.length === 0) {
    col.innerHTML = '<div class="subjects-col-hint">No subjects for this semester</div>';
    return;
  }
  col.innerHTML = `
    <div class="table-wrap" style="margin:0; border:none; border-radius:0;">
      <table>
        <thead><tr><th>Name</th><th>Code</th><th>Manuals</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>${list.map(s => `
          <tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.code || '—')}</td>
            <td>${s.manual_count}</td>
            <td>${s.notes_count}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick='editSubject(${s.id})'>Edit</button>
              <button class="btn btn-danger btn-sm" onclick='deleteSubject(${s.id}, ${JSON.stringify(s.name)})'>Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function selectSubjectDept(code) {
  subjectsDeptSel = code;
  subjectsSemSel  = '';
  renderSubjectDeptCol();
  renderSubjectSemCol();
  renderSubjectListCol();
}

function selectSubjectSem(sem) {
  subjectsSemSel = sem;
  renderSubjectSemCol();
  renderSubjectListCol();
}

/**
 * Filter the manual upload form's subject dropdown by department + semester.
 * Subjects from the same department or 'both' are eligible; the rest are hidden.
 */
function populateSubjectSelect(sel, current = '', department = '', semester = '') {
  const dept = (department || '').toLowerCase();
  let list = allSubjects.filter(s => {
    if (dept && dept !== 'both' && s.department !== dept && s.department !== 'both') return false;
    if (semester && s.semester !== semester) return false;
    return true;
  });
  if (current && !list.find(s => String(s.id) === String(current))) {
    const orig = allSubjects.find(s => String(s.id) === String(current));
    if (orig) list = list.concat(orig);
  }
  if (list.length === 0) {
    sel.innerHTML = '<option value="">— No subjects for this department / semester —</option>';
    return;
  }
  sel.innerHTML = '<option value="">— Select —</option>' +
    list.map(s => `<option value="${s.id}" ${String(s.id) === String(current) ? 'selected' : ''}>${escapeHtml(s.name)} — ${escapeHtml(s.semester)} (${escapeHtml(deptLabel(s.department))})</option>`).join('');
}

function refreshManualSubjectOptions() {
  const dept = $('manualDepartment').value;
  const sem  = $('manualSemester').value;
  const cur  = $('manualSubjectId').value;
  populateSubjectSelect($('manualSubjectId'), cur, dept, sem);
}
['manualDepartment', 'manualSemester'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('change', refreshManualSubjectOptions);
});

$('btnAddSubject').addEventListener('click', () => {
  $('subjectModalTitle').textContent = 'Add Subject';
  $('subjectForm').reset();
  $('subjectId').value = '';
  populateDeptDropdowns();
  $('subjectDepartment').value = 'both';
  openModal('subjectModal');
});

$('btnImportSubjects').addEventListener('click', () => {
  $('importSubjectFile').value = '';
  $('importSubjectResult').style.display = 'none';
  $('importSubjectResult').innerHTML = '';
  // Populate department dropdown (same options as the add form)
  const sel = $('importSubjectDepartment');
  const depts = [...allDepartments, { code: 'both', name: 'Common (Both Departments)' }];
  sel.innerHTML = depts.map(d =>
    `<option value="${escapeHtml(d.code)}">${escapeHtml(d.name)}</option>`
  ).join('');
  openModal('subjectImportModal');
});

$('btnDoImportSubjects').addEventListener('click', async () => {
  const file = $('importSubjectFile').files[0];
  const dept = $('importSubjectDepartment').value;
  const resultEl = $('importSubjectResult');

  if (!file) { showAlert('error', 'Please select a file'); return; }

  const form = new FormData();
  form.append('file', file);
  form.append('department', dept);

  $('btnDoImportSubjects').disabled = true;
  $('btnDoImportSubjects').textContent = 'Importing…';
  resultEl.style.display = 'none';

  try {
    const res  = await fetch('/api/subjects/import', { method: 'POST', credentials: 'include', body: form });
    const data = await res.json();

    if (!res.ok) {
      resultEl.innerHTML = `<div class="alert alert-error">${escapeHtml(data.error || 'Import failed')}</div>`;
    } else {
      let html = `<div class="alert alert-success">
        <strong>Done.</strong> ${data.added} subject(s) added, ${data.skipped} duplicate(s) skipped.
      </div>`;
      if (data.errors && data.errors.length) {
        html += `<div class="alert alert-warning" style="margin-top:8px;">
          <strong>Warnings (${data.errors.length}):</strong><br>
          ${data.errors.map(e => escapeHtml(e)).join('<br>')}
        </div>`;
      }
      resultEl.innerHTML = html;
      await loadSubjects();
    }
    resultEl.style.display = 'block';
  } catch (e) {
    resultEl.innerHTML = `<div class="alert alert-error">Network error: ${escapeHtml(e.message)}</div>`;
    resultEl.style.display = 'block';
  } finally {
    $('btnDoImportSubjects').disabled = false;
    $('btnDoImportSubjects').textContent = 'Import';
  }
});

function editSubject(id) {
  const s = allSubjects.find(x => x.id === id);
  if (!s) return;
  $('subjectModalTitle').textContent = 'Edit Subject';
  $('subjectId').value          = s.id;
  $('subjectName').value        = s.name;
  $('subjectCode').value        = s.code || '';
  populateDeptDropdowns();
  $('subjectDepartment').value  = s.department;
  $('subjectSemester').value    = s.semester;
  $('subjectDescription').value = s.description || '';
  openModal('subjectModal');
}

async function deleteSubject(id, name) {
  if (!confirm(`Delete subject "${name}"?`)) return;
  try {
    const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Subject deleted'); loadSubjects(); }
    else        { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

$('subjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id   = $('subjectId').value;
  const body = {
    name:        $('subjectName').value.trim(),
    code:        $('subjectCode').value,
    department:  $('subjectDepartment').value,
    semester:    $('subjectSemester').value,
    description: $('subjectDescription').value
  };
  if (!body.name || !body.semester) { showAlert('error', 'Name and semester are required'); return; }
  try {
    const res = await fetch(id ? `/api/subjects/${id}` : '/api/subjects', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', id ? 'Subject updated' : 'Subject created'); closeModal('subjectModal'); loadSubjects(); }
    else        { showAlert('error', d.error || 'Failed to save'); }
  } catch (e) { showAlert('error', 'Network error'); }
});

/* ---------- notes review ---------- */
document.querySelectorAll('#section-notes .tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('#section-notes .tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    notesStatusFilter = t.dataset.status;
    loadNotes();
  });
});

async function loadNotes() {
  const params = new URLSearchParams();
  if (notesStatusFilter) params.set('status', notesStatusFilter);
  try {
    const res = await fetch('/api/notes?' + params.toString(), { credentials: 'include' });
    const data = await res.json();
    const tbody = $('notesTableBody');
    tbody.innerHTML = data.notes.length === 0
      ? '<tr><td colspan="7" style="text-align:center; padding:30px;">No notes in this view.</td></tr>'
      : data.notes.map(n => `
        <tr>
          <td><strong>${escapeHtml(n.title)}</strong></td>
          <td>${escapeHtml(n.submitted_by)}<br><small style="color:var(--text-muted);">${escapeHtml(n.submitted_email || '')}</small></td>
          <td><span class="badge">${escapeHtml(deptLabel(n.department))}</span></td>
          <td>${escapeHtml(n.semester)}</td>
          <td>${escapeHtml(n.subject_name || n.subject || '—')}</td>
          <td><span class="badge badge-${n.status}">${escapeHtml(n.status.toUpperCase())}</span></td>
          <td>
            <a href="/api/notes/${n.id}/download" class="btn btn-ghost btn-sm">Download</a>
            <button class="btn btn-success btn-sm" onclick="reviewNote(${n.id}, 'approved')">Approve</button>
            <button class="btn btn-warning btn-sm" onclick="reviewNote(${n.id}, 'rejected')">Reject</button>
            <button class="btn btn-danger btn-sm" onclick="deleteNote(${n.id}, ${JSON.stringify(n.title).replace(/"/g,'&quot;')})">Delete</button>
          </td>
        </tr>`).join('');
  } catch (e) { showAlert('error', 'Failed to load notes'); }
}

async function reviewNote(id, status) {
  try {
    const res = await fetch(`/api/notes/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    if (res.ok) { showAlert('success', `Note ${status}`); loadNotes(); }
    else        { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

async function deleteNote(id, title) {
  if (!confirm(`Delete note "${title}"?`)) return;
  try {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Note deleted'); loadNotes(); }
    else        { showAlert('error', 'Failed'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

/* ---------- users ---------- */
async function loadUsers() {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'include' });
    if (!res.ok) {
      $('usersTableBody').innerHTML = '<tr><td colspan="7" style="padding:30px; text-align:center;">Access denied — only the main admins can view this section.</td></tr>';
      return;
    }
    const data = await res.json();
    $('usersTableBody').innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.username)}</strong></td>
        <td>${escapeHtml(u.full_name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="role-chip role-${u.role}">${escapeHtml(u.role.replace('_',' '))}</span></td>
        <td>${escapeHtml(deptLabel(u.department) || '—')}</td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          ${currentUser.role === 'super_admin' ? `
            <button class="btn btn-secondary btn-sm" onclick="editUser(${u.id})">Edit</button>
            ${u.id !== currentUser.id
              ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, ${JSON.stringify(u.username).replace(/"/g,'&quot;')})">Remove</button>`
              : '<small style="color:var(--text-muted);">You</small>'}
          ` : '<small style="color:var(--text-muted);">view only</small>'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:30px;">No users found.</td></tr>';
  } catch (e) { showAlert('error', 'Failed to load users'); }
}

$('btnAddUser').addEventListener('click', () => {
  $('userModalTitle').textContent = 'Add User';
  $('userForm').reset();
  $('userId').value = '';
  $('userPassword').required = true;
  $('passwordHint').textContent = '(min 6 chars)';
  populateDeptDropdowns();
  $('userRole').value = 'admin';
  openModal('userModal');
});

async function editUser(id) {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'include' });
    const data = await res.json();
    const u = data.users.find(x => x.id === id);
    if (!u) return;
    $('userModalTitle').textContent = 'Edit User';
    $('userId').value         = u.id;
    $('userUsername').value   = u.username;
    $('userUsername').disabled = true;
    $('userFullName').value   = u.full_name;
    $('userEmail').value      = u.email;
    populateDeptDropdowns();
    $('userRole').value       = u.role;
    $('userDepartment').value = u.department || '';
    $('userPassword').value   = '';
    $('userPassword').required = false;
    $('passwordHint').textContent = '(leave blank to keep current)';
    openModal('userModal');
  } catch (e) { showAlert('error', 'Failed to load user'); }
}

async function deleteUser(id, username) {
  if (!confirm(`Remove user "${username}"?`)) return;
  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'User removed'); loadUsers(); }
    else        { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  } catch (e) { showAlert('error', 'Network error'); }
}

$('userForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('userId').value;
  const payload = {
    username:   $('userUsername').value.trim(),
    full_name:  $('userFullName').value.trim(),
    email:      $('userEmail').value.trim(),
    role:       $('userRole').value,
    department: $('userDepartment').value || null,
    password:   $('userPassword').value || undefined
  };
  if (!payload.username || !payload.full_name || !payload.email) {
    showAlert('error', 'Username, full name and email are required');
    return;
  }
  if (!id && (!payload.password || payload.password.length < 6)) {
    showAlert('error', 'Password is required (min 6 characters)');
    return;
  }
  try {
    const res = await fetch(id ? `/api/admin/users/${id}` : '/api/admin/users', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const d = await res.json();
    if (res.ok) {
      showAlert('success', id ? 'User updated' : 'User created');
      closeModal('userModal');
      $('userUsername').disabled = false;
      loadUsers();
    } else {
      showAlert('error', d.error || 'Failed');
    }
  } catch (e) { showAlert('error', 'Network error'); }
});

/* ---------- login log ---------- */
async function loadLoginLog() {
  try {
    const res = await fetch('/api/admin/login-log', { credentials: 'include' });
    if (!res.ok) {
      $('loginLogTableBody').innerHTML = '<tr><td colspan="6" style="padding:30px; text-align:center;">Access denied</td></tr>';
      return;
    }
    const data = await res.json();
    $('loginLogTableBody').innerHTML = data.entries.length === 0
      ? '<tr><td colspan="6" style="text-align:center; padding:30px;">No login activity recorded yet.</td></tr>'
      : data.entries.map(e => `
          <tr>
            <td style="font-size:12px; white-space:nowrap;">${formatDate(e.created_at)}</td>
            <td><strong>${escapeHtml(e.full_name || e.username)}</strong><br><small style="color:var(--text-muted);">${escapeHtml(e.username)}</small></td>
            <td><span class="role-chip role-${e.role}">${escapeHtml((e.role || '').replace('_',' '))}</span></td>
            <td><span class="badge ${e.action === 'LOGIN' ? 'badge-approved' : 'badge-pending'}">${escapeHtml(e.action)}</span></td>
            <td style="font-size:12px;">${escapeHtml(e.ip_address || '—')}</td>
            <td style="font-size:11px; color:var(--text-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(e.user_agent || '—')}</td>
          </tr>`).join('');
  } catch (e) { showAlert('error', 'Failed to load login log'); }
}

/* ---------- activity log ---------- */
async function loadActivity() {
  try {
    const res = await fetch('/api/admin/activity', { credentials: 'include' });
    const data = await res.json();
    $('activityTableBody').innerHTML = data.activities.length === 0
      ? '<tr><td colspan="4" style="text-align:center; padding:30px;">No activity yet.</td></tr>'
      : data.activities.map(a => `
          <tr>
            <td style="font-size:12px; white-space:nowrap;">${formatDate(a.created_at)}</td>
            <td>${escapeHtml(a.full_name || a.username || '—')}</td>
            <td><strong>${escapeHtml(a.action)}</strong></td>
            <td style="font-size:13px;">${escapeHtml(a.details || '')}</td>
          </tr>`).join('');
  } catch (e) { showAlert('error', 'Failed to load activity'); }
}

/* ---------- account ---------- */
$('passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cur = $('currentPassword').value;
  const np  = $('newPassword').value;
  const cp  = $('confirmPassword').value;
  if (np !== cp) { showAlert('error', 'New passwords do not match', $('passwordAlert')); return; }
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ current_password: cur, new_password: np })
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', 'Password changed', $('passwordAlert')); $('passwordForm').reset(); }
    else        { showAlert('error', d.error || 'Failed', $('passwordAlert')); }
  } catch (e) { showAlert('error', 'Network error', $('passwordAlert')); }
});

/* ---------- init ----------
 * Each step runs inside its own try/catch so a single failing endpoint
 * doesn't block the rest of the page, and errors surface in the alert bar.
 */
async function safeRun(label, fn) {
  try { await fn(); }
  catch (e) {
    console.error(`[admin init] ${label} failed:`, e);
    showAlert('error', `${label} failed: ${e.message || e}`);
  }
}

(async function init() {
  await safeRun('Authentication', checkAuth);
  if (!currentUser) return;

  $('welcomeText').textContent = `Welcome, ${currentUser.full_name}`;
  await safeRun('Load departments', loadAllDepartments);
  await safeRun('Load categories',  loadCategoriesAdmin);
  await safeRun('Load subjects',    loadSubjects);
  await safeRun('Load dashboard',   loadDashboard);

  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const link = document.querySelector(`.admin-nav a[data-section="${hash}"]`);
    if (link) link.click();
  }
})();

document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
});

window.toggleVisibility = toggleVisibility;
window.deleteManual     = deleteManual;
window.editManual       = editManual;
window.editCategory     = editCategory;
window.deleteCategory   = deleteCategory;
window.editSubject        = editSubject;
window.deleteSubject      = deleteSubject;
window.selectSubjectDept  = selectSubjectDept;
window.selectSubjectSem   = selectSubjectSem;
window.editDepartment   = editDepartment;
window.deleteDepartment = deleteDepartment;
window.reviewNote       = reviewNote;
window.deleteNote       = deleteNote;
window.editUser         = editUser;
window.deleteUser       = deleteUser;
window.closeModal       = closeModal;
window.loadAdminManuals = loadAdminManuals;
