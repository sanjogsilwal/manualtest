import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import PdfViewer from '../../components/PdfViewer';
import { formatDate, formatBytes, deptLabel, setDeptLabel } from '../../utils/helpers';

const SEMESTERS = ['1st Semester','2nd Semester','3rd Semester','4th Semester','5th Semester','6th Semester','7th Semester','8th Semester','9th Semester','10th Semester'];
const SEM_ORDER = SEMESTERS;

function xhrUpload(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `HTTP ${xhr.status}`));
      } catch { reject(new Error('Invalid server response')); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

export default function Admin() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');

  // Shared data
  const [allDepartments, setAllDepartments] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [allSubjects, setAllSubjects] = useState([]);

  // Alert
  const [alert, setAlert] = useState(null);
  const alertTimerRef = useRef(null);

  function showAlert(type, msg) {
    clearTimeout(alertTimerRef.current);
    setAlert({ type, msg });
    alertTimerRef.current = setTimeout(() => setAlert(null), 4500);
  }

  // Auth check
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        const u = d.user || d.admin;
        if (!u || !['super_admin','admin','teacher'].includes(u.role)) {
          navigate('/login'); return;
        }
        setCurrentUser(u);
      })
      .catch(() => navigate('/login'));
  }, [navigate]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    ['user_token','user_info','admin_token','admin_info'].forEach(k => localStorage.removeItem(k));
    navigate('/login');
  }

  // Load shared data
  const loadAllDepartments = useCallback(async () => {
    const res = await fetch('/api/admin/departments');
    const data = await res.json();
    const depts = data.departments || [];
    setAllDepartments(depts);
    depts.forEach(d => setDeptLabel(d.code, d.name));
  }, []);

  const loadAllCategories = useCallback(async () => {
    const res = await fetch('/api/admin/categories');
    const data = await res.json();
    setAllCategories(data.categories || []);
  }, []);

  const loadAllSubjects = useCallback(async () => {
    const res = await fetch('/api/subjects');
    const data = await res.json();
    setAllSubjects(data.subjects || []);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    Promise.all([loadAllDepartments(), loadAllCategories(), loadAllSubjects()]);
    const hash = window.location.hash.replace('#', '');
    if (hash) setActiveSection(hash);
  }, [currentUser, loadAllDepartments, loadAllCategories, loadAllSubjects]);

  function navTo(section) {
    setActiveSection(section);
    window.location.hash = section;
  }

  if (!currentUser) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>;

  const isSuperAdmin = currentUser.role === 'super_admin';
  const isAdmin      = currentUser.role === 'admin';
  const isTeacher    = currentUser.role === 'teacher';

  return (
    <>
      {/* Inline styles from admin.html */}
      <style>{`
        .admin-header { background: var(--panel); color: var(--panel-text); padding: 14px 0; border-bottom: 3px solid var(--accent); }
        .admin-header .container { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
        .admin-header .brand-text h1 { color: var(--panel-text); font-size: 16px; }
        .admin-header .brand-text .sub { color: var(--panel-text-muted); font-size: 12px; }
        .admin-header .brand-text .dept { color: var(--accent-dark); }
        .admin-header .brand-logo { width: 44px; height: 44px; font-size: 18px; border: 2px solid var(--accent); }
        .admin-header .header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .admin-header .header-actions span { font-size: 13px; color: var(--panel-text-muted); }
        .subjects-three-col { display: grid; grid-template-columns: 200px 190px 1fr; border: 1px solid var(--border-strong); border-radius: 8px; overflow: hidden; min-height: 420px; }
        .subjects-col { border-right: 1px solid var(--border-strong); display: flex; flex-direction: column; }
        .subjects-col:last-child { border-right: none; }
        .subjects-col-header { padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-muted); background: var(--panel); border-bottom: 1px solid var(--border-strong); flex-shrink: 0; }
        .subjects-col-body { overflow-y: auto; flex: 1; }
        .subjects-col-item { padding: 10px 14px; font-size: 14px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background .12s; line-height: 1.4; }
        .subjects-col-item:hover { background: var(--panel); }
        .subjects-col-item.active { background: var(--primary); color: #fff; font-weight: 600; }
        .subjects-col-hint { padding: 18px 14px; color: var(--text-muted); font-size: 13px; font-style: italic; }
        .subjects-col-main .subjects-col-body { padding: 12px; }
        .admin-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) { .admin-two-col { grid-template-columns: 1fr; } .subjects-three-col { grid-template-columns: 1fr; min-height: unset; } .subjects-col { border-right: none; border-bottom: 1px solid var(--border-strong); min-height: 200px; } .subjects-col:last-child { border-bottom: none; } .admin-header .brand-text h1 { font-size: 14px; } }
      `}</style>

      <header className="admin-header">
        <div className="container">
          <Link to="/admin" className="brand" style={{ textDecoration: 'none', color: '#fff' }}>
            <div className="brand-logo placeholder">
              <img src="/images/tu-logo.png" alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className="brand-text">
              <span className="sub">IOE Thapathali Campus</span>
              <h1>LearnSpace - Admin</h1>
              <span className="dept">Upload &amp; Notes Management</span>
            </div>
          </Link>
          <div className="header-actions">
            <span>Welcome, {currentUser.full_name}</span>
            <a href="/" className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer">View Site</a>
            <button className="btn btn-primary btn-sm" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div className="user-info">
            <div className="name">{currentUser.full_name}</div>
            <div className="role">{currentUser.role.replace('_', ' ')}</div>
          </div>
          <ul className="admin-nav">
            {[
              ['dashboard', 'Dashboard'],
              ['manuals', 'Upload'],
              ...(isSuperAdmin ? [['departments', 'Departments']] : []),
              ['subjects', 'Subjects'],
              ...(!isTeacher ? [['categories', 'Categories']] : []),
              ['notes', 'Student Notes'],
              ...(!isTeacher ? [['users', 'Members']] : []),
              ['loginlog', 'Login Log'],
              ['activity', 'Activity Log'],
              ['account', 'My Account'],
            ].map(([key, label]) => (
              <li key={key}>
                <a
                  href={`#${key}`}
                  className={activeSection === key ? 'active' : ''}
                  onClick={e => { e.preventDefault(); navTo(key); }}
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        <main className="admin-content">
          {alert && (
            <div className={`alert alert-${alert.type}`} style={{ marginBottom: 16 }}>{alert.msg}</div>
          )}

          {activeSection === 'dashboard' && (
            <DashboardSection showAlert={showAlert} />
          )}
          {activeSection === 'manuals' && (
            <ManualsSection
              showAlert={showAlert}
              allCategories={allCategories}
              allSubjects={allSubjects}
              allDepartments={allDepartments}
              currentUser={currentUser}
            />
          )}
          {activeSection === 'departments' && isSuperAdmin && (
            <DepartmentsSection
              showAlert={showAlert}
              allDepartments={allDepartments}
              reloadDepartments={loadAllDepartments}
              currentUser={currentUser}
            />
          )}
          {activeSection === 'subjects' && (
            <SubjectsSection
              showAlert={showAlert}
              allSubjects={allSubjects}
              allDepartments={allDepartments}
              reloadSubjects={loadAllSubjects}
            />
          )}
          {activeSection === 'categories' && !isTeacher && (
            <CategoriesSection
              showAlert={showAlert}
              allCategories={allCategories}
              reloadCategories={loadAllCategories}
            />
          )}
          {activeSection === 'notes' && (
            <NotesSection showAlert={showAlert} allDepartments={allDepartments} />
          )}
          {activeSection === 'users' && !isTeacher && (
            <UsersSection
              showAlert={showAlert}
              allDepartments={allDepartments}
              currentUser={currentUser}
            />
          )}
          {activeSection === 'loginlog' && (
            <LoginLogSection showAlert={showAlert} />
          )}
          {activeSection === 'activity' && (
            <ActivitySection showAlert={showAlert} />
          )}
          {activeSection === 'account' && (
            <AccountSection showAlert={showAlert} />
          )}
        </main>
      </div>
    </>
  );
}

/* ===== Dashboard ===== */
function DashboardSection({ showAlert }) {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [topDownloaded, setTopDownloaded] = useState([]);

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setStats(data.stats);
        setRecentActivity(data.recentActivity || []);
        setTopDownloaded(data.topDownloaded || []);
      })
      .catch(() => showAlert('error', 'Failed to load dashboard'));
  }, []);

  return (
    <div id="section-dashboard">
      <div className="section-bar"><h2>Dashboard Overview</h2></div>
      {stats && (
        <div className="dashboard-stats">
          <div className="dash-stat"><div className="num">{stats.totalManuals}</div><div className="lbl">Total Manuals</div></div>
          <div className="dash-stat"><div className="num">{stats.publicManuals}</div><div className="lbl">Public</div></div>
          <div className="dash-stat"><div className="num">{stats.privateManuals}</div><div className="lbl">Private</div></div>
          <div className="dash-stat"><div className="num">{stats.totalSubjects}</div><div className="lbl">Subjects</div></div>
          <div className="dash-stat"><div className="num">{stats.pendingNotes}</div><div className="lbl">Notes Pending</div></div>
          <div className="dash-stat"><div className="num">{stats.totalDownloads}</div><div className="lbl">Total Downloads</div></div>
        </div>
      )}
      <div className="admin-two-col">
        <div className="card">
          <div className="card-header"><h3>Recent Activity</h3></div>
          <div className="card-body">
            {recentActivity.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
            ) : recentActivity.map((a, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <strong>{a.full_name || 'System'}</strong>
                <span style={{ color: 'var(--text-muted)' }}>- {a.action}</span><br />
                <small style={{ color: 'var(--text-light)' }}>{a.details || ''} • {formatDate(a.created_at)}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Most Downloaded</h3></div>
          <div className="card-body">
            {topDownloaded.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No downloads yet.</p>
            ) : topDownloaded.map((m, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{m.title}</span>
                <strong style={{ color: 'var(--accent-dark)' }}>{m.download_count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Manuals ===== */
function ManualsSection({ showAlert, allCategories, allSubjects, allDepartments, currentUser }) {
  const [manuals, setManuals] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', department: '', semester: '' });
  const [modal, setModal] = useState({ open: false, manual: null });
  const [viewingManual, setViewingManual] = useState(null);
  const debounceRef = useRef(null);

  const loadManuals = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    if (filters.department) params.set('department', filters.department);
    if (filters.semester) params.set('semester', filters.semester);
    fetch('/api/manuals?' + params.toString(), { credentials: 'include' })
      .then(r => r.json())
      .then(d => setManuals(d.manuals || []))
      .catch(() => showAlert('error', 'Failed to load manuals'));
  }, [filters]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadManuals, 250);
    return () => clearTimeout(debounceRef.current);
  }, [loadManuals]);

  async function handleToggleVisibility(id, isPublic) {
    const res = await fetch(`/api/manuals/${id}/visibility`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ is_public: !!isPublic })
    });
    if (res.ok) { showAlert('success', `Manual is now ${isPublic ? 'PUBLIC' : 'PRIVATE'}`); loadManuals(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  }

  async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"? This permanently removes the file.`)) return;
    const res = await fetch(`/api/manuals/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Manual deleted'); loadManuals(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  }

  async function openEdit(id) {
    const res = await fetch(`/api/manuals/${id}`, { credentials: 'include' });
    const data = await res.json();
    setModal({ open: true, manual: data.manual });
  }

  function openCreate() {
    setModal({ open: true, manual: null });
  }

  function handleDone() {
    setModal({ open: false, manual: null });
    loadManuals();
  }

  return (
    <div>
      <div className="section-bar">
        <h2>Manage Lab Manuals</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Upload</button>
      </div>
      <div className="filter-bar">
        <input type="search" placeholder="Search manuals..."
          value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="">All Categories</option>
          {allCategories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.manual_count})</option>)}
        </select>
        <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}>
          <option value="">All Departments</option>
          {allDepartments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
        <select value={filters.semester} onChange={e => setFilters(f => ({ ...f, semester: e.target.value }))}>
          <option value="">All Semesters</option>
          {SEMESTERS.map(s => <option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={loadManuals}>Refresh</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th><th>Department</th><th>Semester</th><th>Subject</th>
              <th>File</th><th>Downloads</th><th>Visibility</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {manuals === null ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30 }}><div className="spinner"></div></td></tr>
            ) : manuals.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No manuals found. Click "Upload New Manual" to get started.</td></tr>
            ) : manuals.map(m => (
              <tr key={m.id}>
                <td>
                  <strong>{m.title}</strong>
                  {m.description && <><br /><small style={{ color: 'var(--text-muted)' }}>{(m.description || '').slice(0, 80)}{m.description.length > 80 ? '…' : ''}</small></>}
                </td>
                <td><span className="badge">{deptLabel(m.department) || '-'}</span></td>
                <td>{m.semester || '-'}</td>
                <td>{m.subject_name || m.subject || '-'}</td>
                <td><span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(m.file_type || '').toUpperCase()}<br />{formatBytes(m.file_size)}</span></td>
                <td><strong>{m.download_count}</strong></td>
                <td>
                  {(currentUser.role !== 'teacher' || m.uploaded_by === currentUser.id) ? (
                    <>
                      <label className="toggle">
                        <input type="checkbox" checked={!!m.is_public}
                          onChange={e => handleToggleVisibility(m.id, e.target.checked)} />
                        <span className="slider"></span>
                      </label>
                      <div style={{ fontSize: 11, marginTop: 4, color: m.is_public ? 'var(--success)' : 'var(--warning)' }}>
                        {m.is_public ? 'PUBLIC' : 'PRIVATE'}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: m.is_public ? 'var(--success)' : 'var(--warning)' }}>
                      {m.is_public ? 'PUBLIC' : 'PRIVATE'}
                    </div>
                  )}
                </td>
                <td>
                  {m.file_type === 'pdf' && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => setViewingManual(m)}>View</button>
                      {' '}
                    </>
                  )}
                  <a href={`/api/manuals/${m.id}/download`} className="btn btn-ghost btn-sm">Download</a>
                  {(currentUser.role !== 'teacher' || m.uploaded_by === currentUser.id) && (
                    <>
                      {' '}
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(m.id)}>Edit</button>
                      {' '}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id, m.title)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ManualModal
        isOpen={modal.open}
        manual={modal.manual}
        allCategories={allCategories}
        allSubjects={allSubjects}
        allDepartments={allDepartments}
        onClose={() => setModal({ open: false, manual: null })}
        onDone={handleDone}
        showAlert={showAlert}
      />
      <PdfViewer manual={viewingManual} onClose={() => setViewingManual(null)} />
    </div>
  );
}

function ManualModal({ isOpen, manual, allCategories, allSubjects, allDepartments, onClose, onDone, showAlert }) {
  const [form, setForm] = useState({ title: '', description: '', subject: '', semester: '', department: '', subject_id: '', category_id: '', is_public: true });
  const [fileItems, setFileItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    if (manual) {
      // Existing rows may still have department='both' from before that option
      // was removed. Treat those as unset so the admin must pick a real dept
      // before saving (the select is `required`).
      const dept = manual.department && manual.department !== 'both' ? manual.department : '';
      setForm({
        title: manual.title || '', description: manual.description || '',
        subject: manual.subject || '', semester: manual.semester || '',
        department: dept, subject_id: manual.subject_id || '',
        category_id: manual.category_id || '', is_public: !!manual.is_public
      });
    } else {
      setForm({ title: '', description: '', subject: '', semester: '', department: '', subject_id: '', category_id: '', is_public: true });
      setFileItems([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [manual, isOpen]);

  function handleFileChange(e) {
    const selected = Array.from(e.target.files);
    setFileItems(selected.map((f, i) => ({
      file: f,
      // Single file: pre-fill from the Title field; multiple files: use filename
      title: selected.length === 1 && form.title.trim()
        ? form.title.trim()
        : f.name.replace(/\.[^/.]+$/, ''),
      progress: 0,
      status: 'pending',
      error: null
    })));
  }

  function filteredSubjects() {
    const dept = (form.department || '').toLowerCase();
    return allSubjects.filter(s => {
      if (dept && s.department !== dept) return false;
      if (form.semester && s.semester !== form.semester) return false;
      return true;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // ── Edit mode: simple metadata PUT ──
    if (manual) {
      setSaving(true);
      try {
        const res = await fetch(`/api/manuals/${manual.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...form, subject_id: form.subject_id || null, category_id: form.category_id || null })
        });
        const d = await res.json();
        if (res.ok) { showAlert('success', 'Manual updated'); onDone(); }
        else showAlert('error', d.error || 'Update failed');
      } catch { showAlert('error', 'Network error'); }
      finally { setSaving(false); }
      return;
    }

    // ── Create mode: upload files with XHR progress ──
    if (fileItems.length === 0) { showAlert('error', 'Select at least one file'); return; }
    if (fileItems.some(f => !f.title.trim())) { showAlert('error', 'Every file must have a title'); return; }

    setSaving(true);
    let allOk = true;

    for (let i = 0; i < fileItems.length; i++) {
      const item = fileItems[i];
      setFileItems(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f));

      const fd = new FormData();
      fd.append('title',       item.title.trim());
      fd.append('description', form.description);
      fd.append('subject',     form.subject);
      fd.append('semester',    form.semester);
      fd.append('department',  form.department);
      fd.append('subject_id',  form.subject_id || '');
      fd.append('category_id', form.category_id || '');
      fd.append('is_public',   form.is_public ? '1' : '0');
      fd.append('file',        item.file);

      try {
        await xhrUpload('/api/manuals', fd, (pct) => {
          setFileItems(prev => prev.map((f, idx) => idx === i ? { ...f, progress: pct } : f));
        });
        setFileItems(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f));
      } catch (err) {
        setFileItems(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: err.message } : f));
        allOk = false;
      }
    }

    setSaving(false);
    if (allOk) {
      showAlert('success', `${fileItems.length} file${fileItems.length > 1 ? 's' : ''} uploaded successfully`);
      setTimeout(onDone, 900);
    } else {
      showAlert('error', 'Some files failed - see details below');
    }
  }

  const uploadLabel = fileItems.length > 1 ? `Upload ${fileItems.length} Files` : 'Upload';

  return (
    <Modal
      isOpen={isOpen}
      title={manual ? 'Edit Manual' : 'Upload Manual'}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="manualForm" className="btn btn-primary" disabled={saving}>
            {saving ? 'Uploading…' : (manual ? 'Save Changes' : uploadLabel)}
          </button>
        </>
      }
    >
      <form id="manualForm" onSubmit={handleSubmit}>
        {/* Title - shown for both create and edit */}
        <div className="form-group"><label>Title *</label>
          <input
            type="text"
            required
            placeholder="e.g., Thermodynamics Lab Manual"
            value={form.title}
            onChange={e => {
              const val = e.target.value;
              setForm(f => ({ ...f, title: val }));
              // Keep single-file title in sync while user hasn't touched it yet
              if (!manual && fileItems.length === 1 && fileItems[0].status === 'pending') {
                setFileItems(prev => [{ ...prev[0], title: val }]);
              }
            }}
          />
        </div>
        <div className="form-group"><label>Description</label>
          <textarea placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="form-row-3">
          <div className="form-group"><label>Department *</label>
            <select required value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value, subject_id: '' }))}>
              <option value="">- Select -</option>
              {allDepartments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Semester</label>
            <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value, subject_id: '' }))}>
              <option value="">- Select -</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Subject</label>
            <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}>
              <option value="">- Select -</option>
              {filteredSubjects().map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.semester} ({deptLabel(s.department)})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Subject (free text)</label>
            <input type="text" placeholder="e.g., Thermodynamics" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          </div>
          <div className="form-group"><label>Category</label>
            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">- Uncategorized -</option>
              {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {!manual && (
          <div className="form-group">
            <label>Files * <small>(PDF, DOC, DOCX, PPT, ZIP - max 50 MB each - select multiple)</small></label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
              onChange={handleFileChange}
              disabled={saving}
            />
          </div>
        )}

        {/* Per-file titles + progress bars */}
        {!manual && fileItems.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {fileItems.map((item, i) => (
              <div key={i} style={{
                border: `1px solid ${item.status === 'error' ? '#fca5a5' : 'var(--border)'}`,
                borderRadius: 6, padding: '10px 12px', marginBottom: 8,
                background: item.status === 'done' ? '#f0fdf4' : item.status === 'error' ? '#fff1f1' : 'var(--bg-soft, #fafafa)'
              }}>
                {/* Title row */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0, width: 20, textAlign: 'center' }}>
                    {item.status === 'done' ? '✓' : item.status === 'error' ? '✗' : i + 1}
                  </span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={e => setFileItems(prev => prev.map((f, idx) => idx === i ? { ...f, title: e.target.value } : f))}
                    placeholder="Manual title"
                    disabled={saving}
                    required
                    style={{ flex: 1, padding: '5px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4, background: '#fff' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 28, marginBottom: item.status !== 'pending' ? 6 : 0 }}>
                  {item.file.name} · {(item.file.size / 1024 / 1024).toFixed(1)} MB
                </div>

                {/* Progress bar */}
                {(item.status === 'uploading' || item.status === 'done') && (
                  <div style={{ paddingLeft: 28 }}>
                    <div style={{ background: '#e5e7eb', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                      <div style={{
                        width: `${item.progress}%`, height: '100%', borderRadius: 99,
                        background: item.status === 'done' ? '#22c55e' : 'var(--primary)',
                        transition: 'width 0.15s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {item.status === 'done' ? 'Upload complete' : `${item.progress}% uploaded`}
                    </div>
                  </div>
                )}
                {item.status === 'error' && (
                  <div style={{ paddingLeft: 28, fontSize: 12, color: '#dc2626', marginTop: 2 }}>{item.error}</div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="form-checkbox">
          <input type="checkbox" id="manualIsPublic" checked={form.is_public}
            onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} />
          <label htmlFor="manualIsPublic">Public - visible to all visitors (uncheck to make Private)</label>
        </div>
      </form>
    </Modal>
  );
}

/* ===== Departments ===== */
function DepartmentsSection({ showAlert, allDepartments, reloadDepartments, currentUser }) {
  const [modal, setModal] = useState({ open: false, dept: null });

  async function handleDelete(id, name) {
    if (!confirm(`Delete department "${name}"?`)) return;
    const res = await fetch(`/api/admin/departments/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Department deleted'); reloadDepartments(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  }

  async function handleSave(form) {
    const id = form.id;
    const res = await fetch(id ? `/api/admin/departments/${id}` : '/api/admin/departments', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: form.name, code: form.code.toLowerCase(), description: form.description })
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', id ? 'Department updated' : 'Department created'); setModal({ open: false, dept: null }); reloadDepartments(); }
    else showAlert('error', d.error || 'Failed to save');
  }

  return (
    <div>
      <div className="section-bar">
        <h2>Manage Departments</h2>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, dept: null })}>+ Add Department</button>
      </div>
      <div className="alert alert-info">Adding a new department lets you organise subjects, lab manuals and notes under it. Only super-admins can create or remove departments.</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Code</th><th>Description</th><th>Subjects</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {allDepartments.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>No departments yet.</td></tr>
            ) : allDepartments.map(d => (
              <tr key={d.id}>
                <td><strong>{d.name}</strong></td>
                <td><code>{d.code}</code></td>
                <td>{d.description || '-'}</td>
                <td>{d.subject_count}</td>
                <td>{formatDate(d.created_at)}</td>
                <td>
                  {currentUser.role === 'super_admin' ? (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal({ open: true, dept: d })}>Edit</button>
                      {' '}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(d.id, d.name)}>Delete</button>
                    </>
                  ) : <small style={{ color: 'var(--text-muted)' }}>view only</small>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DeptModal isOpen={modal.open} dept={modal.dept} onClose={() => setModal({ open: false, dept: null })} onSave={handleSave} />
    </div>
  );
}

function DeptModal({ isOpen, dept, onClose, onSave }) {
  const [form, setForm] = useState({ id: '', name: '', code: '', description: '' });
  useEffect(() => {
    setForm(dept ? { id: dept.id, name: dept.name, code: dept.code, description: dept.description || '' } : { id: '', name: '', code: '', description: '' });
  }, [dept, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <Modal isOpen={isOpen} title={dept ? 'Edit Department' : 'Add Department'} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="deptForm" className="btn btn-primary">Save</button>
        </>
      }
    >
      <form id="deptForm" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group"><label>Name *</label>
            <input type="text" required placeholder="e.g., Civil Engineering"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group"><label>Code *</label>
            <input type="text" required placeholder="e.g., civil" disabled={!!dept}
              value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            <small>Lowercase short identifier (a-z, 0-9, _)</small>
          </div>
        </div>
        <div className="form-group"><label>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </form>
    </Modal>
  );
}

/* ===== Subjects ===== */
function SubjectsSection({ showAlert, allSubjects, allDepartments, reloadSubjects }) {
  const [deptSel, setDeptSel] = useState('');
  const [semSel, setSemSel] = useState('');
  const [modal, setModal] = useState({ open: false, subject: null });
  const [importModalOpen, setImportModalOpen] = useState(false);

  const depts = allDepartments;

  const eligibleSems = [...new Set(
    allSubjects
      .filter(s => !deptSel || s.department === deptSel)
      .map(s => s.semester)
  )].sort((a, b) => SEM_ORDER.indexOf(a) - SEM_ORDER.indexOf(b));

  const list = allSubjects.filter(s =>
    (!deptSel || s.department === deptSel) &&
    (!semSel || s.semester === semSel)
  );

  async function handleDelete(id, name) {
    if (!confirm(`Delete subject "${name}"?`)) return;
    const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Subject deleted'); reloadSubjects(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  }

  async function handleSave(form) {
    const id = form.id;
    const res = await fetch(id ? `/api/subjects/${id}` : '/api/subjects', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: form.name, code: form.code, department: form.department, semester: form.semester, description: form.description })
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', id ? 'Subject updated' : 'Subject created'); setModal({ open: false, subject: null }); reloadSubjects(); }
    else showAlert('error', d.error || 'Failed to save');
  }

  return (
    <div>
      <div className="section-bar">
        <h2>Manage Subjects</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setImportModalOpen(true)}>Import Excel</button>
          <button className="btn btn-primary" onClick={() => setModal({ open: true, subject: null })}>+ Add Subject</button>
        </div>
      </div>
      <div className="alert alert-info">Select a department, then a semester to view and manage its subjects.</div>
      <div className="subjects-three-col">
        <div className="subjects-col">
          <div className="subjects-col-header">Department</div>
          <div className="subjects-col-body">
            {depts.map(d => (
              <div key={d.code}
                className={`subjects-col-item${deptSel === d.code ? ' active' : ''}`}
                onClick={() => { setDeptSel(d.code); setSemSel(''); }}>
                {d.name}
              </div>
            ))}
          </div>
        </div>
        <div className="subjects-col">
          <div className="subjects-col-header">Semester</div>
          <div className="subjects-col-body">
            {!deptSel ? (
              <div className="subjects-col-hint">Select a department first</div>
            ) : eligibleSems.length === 0 ? (
              <div className="subjects-col-hint">No subjects yet</div>
            ) : eligibleSems.map(sem => (
              <div key={sem}
                className={`subjects-col-item${semSel === sem ? ' active' : ''}`}
                onClick={() => setSemSel(sem)}>
                {sem}
              </div>
            ))}
          </div>
        </div>
        <div className="subjects-col subjects-col-main">
          <div className="subjects-col-header">
            {semSel ? `Subjects - ${semSel} (${list.length})` : 'Subjects'}
          </div>
          <div className="subjects-col-body">
            {!deptSel || !semSel ? (
              <div className="subjects-col-hint">{!deptSel ? 'Select a department and semester' : 'Select a semester'}</div>
            ) : list.length === 0 ? (
              <div className="subjects-col-hint">No subjects for this semester</div>
            ) : (
              <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                <table>
                  <thead><tr><th>Name</th><th>Code</th><th>Manuals</th><th>Notes</th><th>Actions</th></tr></thead>
                  <tbody>
                    {list.map(s => (
                      <tr key={s.id}>
                        <td><strong>{s.name}</strong></td>
                        <td>{s.code || '-'}</td>
                        <td>{s.manual_count}</td>
                        <td>{s.notes_count}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ open: true, subject: s })}>Edit</button>
                          {' '}
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id, s.name)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      <SubjectModal isOpen={modal.open} subject={modal.subject} allDepartments={allDepartments}
        onClose={() => setModal({ open: false, subject: null })} onSave={handleSave} />
      <SubjectImportModal
        isOpen={importModalOpen}
        allDepartments={allDepartments}
        onClose={() => setImportModalOpen(false)}
        onImported={reloadSubjects}
        showAlert={showAlert}
      />
    </div>
  );
}

function SubjectImportModal({ isOpen, allDepartments, onClose, onImported, showAlert }) {
  const [department, setDepartment] = useState('');
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Default to the first real department if available, else empty (forces explicit pick)
      setDepartment(allDepartments[0]?.code || '');
      setFile(null);
      setResult(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen, allDepartments]);

  const depts = allDepartments;

  async function handleImport() {
    if (!file) { showAlert('error', 'Please select a file'); return; }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('department', department);
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch('/api/subjects/import', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setResult({ type: 'error', message: data.error || 'Import failed' });
      } else {
        setResult({
          type: 'success',
          added: data.added || 0,
          skipped: data.skipped || 0,
          errors: data.errors || []
        });
        onImported();
      }
    } catch (e) {
      setResult({ type: 'error', message: 'Network error: ' + e.message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Import Subjects from Excel"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" disabled={importing} onClick={handleImport}>
            {importing ? 'Importing…' : 'Import'}
          </button>
        </>
      }
    >
      <div className="alert alert-info" style={{ marginBottom: 14 }}>
        Upload an <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong> file with these columns:<br />
        <code>Year</code> - 1 through 5<br />
        <code>Part</code> - I or II<br />
        <code>Subject Code</code> - e.g. ME 501 (optional)<br />
        <code>Subject Name</code> - required<br />
        <br />
        Year 1 Part I → 1st Sem, Year 1 Part II → 2nd Sem … Year 5 Part II → 10th Sem.
        You can also use a <code>Semester</code> column (1–10) instead of Year+Part.
        Duplicates are skipped automatically.
      </div>
      <div className="form-group">
        <label>Department *</label>
        <select required value={department} onChange={e => setDepartment(e.target.value)}>
          <option value="" disabled>- Select -</option>
          {depts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>Excel / CSV File *</label>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
          onChange={e => setFile(e.target.files[0] || null)} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <a href="/api/subjects/import/template" className="btn btn-ghost btn-sm" download>
          Download Template
        </a>
      </div>
      {result && result.type === 'error' && (
        <div className="alert alert-error">{result.message}</div>
      )}
      {result && result.type === 'success' && (
        <>
          <div className="alert alert-success">
            <strong>Done.</strong> {result.added} subject(s) added, {result.skipped} duplicate(s) skipped.
          </div>
          {result.errors.length > 0 && (
            <div className="alert alert-warning" style={{ marginTop: 8 }}>
              <strong>Warnings ({result.errors.length}):</strong><br />
              {result.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function SubjectModal({ isOpen, subject, allDepartments, onClose, onSave }) {
  const [form, setForm] = useState({ id: '', name: '', code: '', department: '', semester: '', description: '' });
  useEffect(() => {
    // Existing subjects may have department='both' from before that option
    // was removed. Reset those to '' so the admin must pick a real dept
    // before saving (the select is `required`).
    setForm(subject
      ? {
          id: subject.id,
          name: subject.name,
          code: subject.code || '',
          department: subject.department && subject.department !== 'both' ? subject.department : '',
          semester: subject.semester,
          description: subject.description || ''
        }
      : { id: '', name: '', code: '', department: '', semester: '', description: '' });
  }, [subject, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <Modal isOpen={isOpen} title={subject ? 'Edit Subject' : 'Add Subject'} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="subjectForm" className="btn btn-primary">Save</button>
        </>
      }
    >
      <form id="subjectForm" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group"><label>Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group"><label>Code</label>
            <input type="text" placeholder="e.g., ME 501" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Department *</label>
            <select required value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
              <option value="">- Select -</option>
              {allDepartments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Semester *</label>
            <select required value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}>
              <option value="">- Select -</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </form>
    </Modal>
  );
}

/* ===== Categories ===== */
function CategoriesSection({ showAlert, allCategories, reloadCategories }) {
  const [modal, setModal] = useState({ open: false, cat: null });

  async function handleDelete(id, name) {
    if (!confirm(`Delete category "${name}"?`)) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Category deleted'); reloadCategories(); }
    else showAlert('error', 'Failed to delete');
  }

  async function handleSave(form) {
    const id = form.id;
    const res = await fetch(id ? `/api/admin/categories/${id}` : '/api/admin/categories', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: form.name, description: form.description })
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', id ? 'Category updated' : 'Category created'); setModal({ open: false, cat: null }); reloadCategories(); }
    else showAlert('error', d.error || 'Failed to save');
  }

  return (
    <div>
      <div className="section-bar">
        <h2>Categories</h2>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, cat: null })}>+ Add Category</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Description</th><th>Manuals</th><th>Actions</th></tr></thead>
          <tbody>
            {allCategories.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30 }}>No categories yet.</td></tr>
            ) : allCategories.map(c => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td>
                <td>{c.description || '-'}</td>
                <td>{c.manual_count}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal({ open: true, cat: c })}>Edit</button>
                  {' '}
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id, c.name)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CategoryModal isOpen={modal.open} cat={modal.cat} onClose={() => setModal({ open: false, cat: null })} onSave={handleSave} />
    </div>
  );
}

function CategoryModal({ isOpen, cat, onClose, onSave }) {
  const [form, setForm] = useState({ id: '', name: '', description: '' });
  useEffect(() => {
    setForm(cat ? { id: cat.id, name: cat.name, description: cat.description || '' } : { id: '', name: '', description: '' });
  }, [cat, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <Modal isOpen={isOpen} title={cat ? 'Edit Category' : 'Add Category'} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="categoryForm" className="btn btn-primary">Save</button>
        </>
      }
    >
      <form id="categoryForm" onSubmit={handleSubmit}>
        <div className="form-group"><label>Name *</label>
          <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group"><label>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </form>
    </Modal>
  );
}

/* ===== Notes ===== */
function NotesSection({ showAlert, allDepartments }) {
  const [notes, setNotes] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');

  const loadNotes = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    fetch('/api/notes?' + params.toString(), { credentials: 'include' })
      .then(r => r.json())
      .then(d => setNotes(d.notes || []))
      .catch(() => showAlert('error', 'Failed to load notes'));
  }, [statusFilter]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function reviewNote(id, status) {
    const res = await fetch(`/api/notes/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ status })
    });
    if (res.ok) { showAlert('success', `Note ${status}`); loadNotes(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  }

  async function deleteNote(id, title) {
    if (!confirm(`Delete note "${title}"?`)) return;
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'Note deleted'); loadNotes(); }
    else showAlert('error', 'Failed');
  }

  return (
    <div>
      <div className="section-bar">
        <h2>Student Notes</h2>
        <div className="tabs" style={{ margin: 0 }}>
          {['pending','approved','rejected',''].map((s, i) => (
            <button key={i} className={`tab${statusFilter === s ? ' active' : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Title</th><th>Submitted by</th><th>Department</th><th>Semester</th><th>Subject</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {notes === null ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}><div className="spinner"></div></td></tr>
            ) : notes.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>No notes in this view.</td></tr>
            ) : notes.map(n => (
              <tr key={n.id}>
                <td><strong>{n.title}</strong></td>
                <td>{n.submitted_by}<br /><small style={{ color: 'var(--text-muted)' }}>{n.submitted_email || ''}</small></td>
                <td><span className="badge">{deptLabel(n.department)}</span></td>
                <td>{n.semester}</td>
                <td>{n.subject_name || n.subject || '-'}</td>
                <td><span className={`badge badge-${n.status}`}>{n.status.toUpperCase()}</span></td>
                <td>
                  <a href={`/api/notes/${n.id}/download`} className="btn btn-ghost btn-sm">Download</a>
                  {' '}
                  <button className="btn btn-success btn-sm" onClick={() => reviewNote(n.id, 'approved')}>Approve</button>
                  {' '}
                  <button className="btn btn-warning btn-sm" onClick={() => reviewNote(n.id, 'rejected')}>Reject</button>
                  {' '}
                  <button className="btn btn-danger btn-sm" onClick={() => deleteNote(n.id, n.title)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== Users ===== */
function UsersSection({ showAlert, allDepartments, currentUser }) {
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState({ open: false, user: null });
  const isSA = currentUser.role === 'super_admin';

  const loadUsers = useCallback(() => {
    fetch('/api/admin/users', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('denied'); return r.json(); })
      .then(d => setUsers(d.users || []))
      .catch(() => setUsers('denied'));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // For admins, only show the teachers they can manage.
  const visibleUsers = Array.isArray(users)
    ? (isSA ? users : users.filter(u => u.role === 'teacher'))
    : users;

  async function handleDelete(id, username) {
    if (!confirm(`Remove user "${username}"?`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showAlert('success', 'User removed'); loadUsers(); }
    else { const d = await res.json(); showAlert('error', d.error || 'Failed'); }
  }

  async function handleSave(form) {
    const id = form.id;
    const payload = { username: form.username, full_name: form.full_name, email: form.email, role: form.role, department: form.department || null };
    if (form.password) payload.password = form.password;
    const res = await fetch(id ? `/api/admin/users/${id}` : '/api/admin/users', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const d = await res.json();
    if (res.ok) { showAlert('success', id ? 'User updated' : 'User created'); setModal({ open: false, user: null }); loadUsers(); }
    else showAlert('error', d.error || 'Failed');
  }

  function canEdit(u) {
    if (u.id === currentUser.id) return false;
    if (isSA) return true;
    return u.role === 'teacher';
  }
  function canDelete(u) {
    if (u.id === currentUser.id) return false;
    if (isSA) return true;
    return u.role === 'teacher';
  }

  return (
    <div>
      <div className="section-bar">
        <h2>{isSA ? 'User Management' : 'Teacher Management'}</h2>
        <button className="btn btn-primary" onClick={() => setModal({ open: true, user: null })}>
          + {isSA ? 'Add User' : 'Add Teacher'}
        </button>
      </div>
      <div className="alert alert-info">
        {isSA
          ? 'Super admins can create and remove admins and teachers. Admins manage teacher accounts.'
          : 'As an admin you can create, edit, and remove teacher accounts for your department.'}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th><th>Full Name</th><th>Email</th><th>Role</th>
              <th>Department</th><th>Created</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers === null ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}><div className="spinner"></div></td></tr>
            ) : visibleUsers === 'denied' ? (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center' }}>Access denied.</td></tr>
            ) : visibleUsers.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>No {isSA ? 'users' : 'teachers'} found.</td></tr>
            ) : visibleUsers.map(u => (
              <tr key={u.id}>
                <td><strong>{u.username}</strong></td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td><span className={`role-chip role-${u.role}`}>{u.role.replace('_', ' ')}</span></td>
                <td>{deptLabel(u.department) || '-'}</td>
                <td>{formatDate(u.created_at)}</td>
                <td>
                  {u.id === currentUser.id ? (
                    <small style={{ color: 'var(--text-muted)' }}>You</small>
                  ) : (
                    <>
                      {canEdit(u) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ open: true, user: u })}>Edit</button>
                      )}
                      {' '}
                      {canDelete(u) && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id, u.username)}>Remove</button>
                      )}
                      {!canEdit(u) && !canDelete(u) && (
                        <small style={{ color: 'var(--text-muted)' }}>-</small>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <UserModal isOpen={modal.open} user={modal.user} allDepartments={allDepartments}
        currentUser={currentUser}
        onClose={() => setModal({ open: false, user: null })} onSave={handleSave} />
    </div>
  );
}

function UserModal({ isOpen, user, allDepartments, currentUser, onClose, onSave }) {
  const isSA = currentUser.role === 'super_admin';
  const defaultRole = isSA ? 'admin' : 'teacher';
  const [form, setForm] = useState({ id: '', username: '', full_name: '', email: '', role: defaultRole, department: '', password: '' });

  useEffect(() => {
    setForm(user
      ? { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role, department: user.department || '', password: '' }
      : { id: '', username: '', full_name: '', email: '', role: defaultRole, department: '', password: '' });
  }, [user, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSave(form);
  }

  return (
    <Modal isOpen={isOpen} title={user ? 'Edit User' : (isSA ? 'Add User' : 'Add Teacher')} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="userForm" className="btn btn-primary">Save</button>
        </>
      }
    >
      <form id="userForm" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group"><label>Username *</label>
            <input type="text" required disabled={!!user} value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
          </div>
          <div className="form-group"><label>Full Name *</label>
            <input type="text" required value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
          </div>
        </div>
        <div className="form-group"><label>Email *</label>
          <input type="email" required value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Password {user ? <small>(leave blank to keep current)</small> : <small>(min 6 chars)</small>}</label>
            <input type="password" minLength={user ? 0 : 6} required={!user} value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="form-group"><label>Role *</label>
            {isSA ? (
              <select required value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            ) : (
              <input type="text" value="Teacher" disabled />
            )}
          </div>
        </div>
        <div className="form-group"><label>Department</label>
          <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
            <option value="">-</option>
            {allDepartments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
      </form>
    </Modal>
  );
}

/* ===== Login Log ===== */
function LoginLogSection({ showAlert }) {
  const [entries, setEntries] = useState(null);
  useEffect(() => {
    fetch('/api/admin/login-log', { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('denied'); return r.json(); })
      .then(d => setEntries(d.entries || []))
      .catch(() => setEntries('denied'));
  }, []);

  return (
    <div>
      <div className="section-bar"><h2>Login &amp; Logout Log</h2></div>
      <div className="alert alert-info">Records sign-in and sign-out events for admins and teachers. Super-admin activity is intentionally not tracked here.</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>IP</th><th>User Agent</th></tr></thead>
          <tbody>
            {entries === null ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}><div className="spinner"></div></td></tr>
            ) : entries === 'denied' ? (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }}>Access denied</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>No login activity recorded yet.</td></tr>
            ) : entries.map((e, i) => (
              <tr key={i}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(e.created_at)}</td>
                <td><strong>{e.full_name || e.username}</strong><br /><small style={{ color: 'var(--text-muted)' }}>{e.username}</small></td>
                <td><span className={`role-chip role-${e.role}`}>{(e.role || '').replace('_', ' ')}</span></td>
                <td><span className={`badge ${e.action === 'LOGIN' ? 'badge-approved' : 'badge-pending'}`}>{e.action}</span></td>
                <td style={{ fontSize: 12 }}>{e.ip_address || '-'}</td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.user_agent || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== Activity Log ===== */
function ActivitySection({ showAlert }) {
  const [activities, setActivities] = useState(null);
  useEffect(() => {
    fetch('/api/admin/activity', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setActivities(d.activities || []))
      .catch(() => showAlert('error', 'Failed to load activity'));
  }, []);

  return (
    <div>
      <div className="section-bar"><h2>Activity Log</h2></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>When</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {activities === null ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30 }}><div className="spinner"></div></td></tr>
            ) : activities.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30 }}>No activity yet.</td></tr>
            ) : activities.map((a, i) => (
              <tr key={i}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(a.created_at)}</td>
                <td>{a.full_name || a.username || '-'}</td>
                <td><strong>{a.action}</strong></td>
                <td style={{ fontSize: 13 }}>{a.details || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===== Account ===== */
function AccountSection({ showAlert }) {
  const [form, setForm] = useState({ current: '', newPass: '', confirm: '' });
  const [alert, setAlert] = useState(null);
  const timerRef = useRef(null);

  function localAlert(type, msg) {
    clearTimeout(timerRef.current);
    setAlert({ type, msg });
    timerRef.current = setTimeout(() => setAlert(null), 4500);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.newPass !== form.confirm) { localAlert('error', 'New passwords do not match'); return; }
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ current_password: form.current, new_password: form.newPass })
    });
    const d = await res.json();
    if (res.ok) { localAlert('success', 'Password changed'); setForm({ current: '', newPass: '', confirm: '' }); }
    else localAlert('error', d.error || 'Failed');
  }

  return (
    <div>
      <div className="section-bar"><h2>My Account</h2></div>
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="card-header"><h3>Change Password</h3></div>
        <div className="card-body">
          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label>Current Password</label>
              <input type="password" required value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} />
            </div>
            <div className="form-group"><label>New Password</label>
              <input type="password" required minLength={6} value={form.newPass} onChange={e => setForm(f => ({ ...f, newPass: e.target.value }))} />
              <small>Minimum 6 characters</small>
            </div>
            <div className="form-group"><label>Confirm New Password</label>
              <input type="password" required value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
            <button type="submit" className="btn btn-primary">Update Password</button>
          </form>
        </div>
      </div>
    </div>
  );
}
