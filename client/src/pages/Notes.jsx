import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useScope } from '../contexts/ScopeContext';
import { formatDate, formatBytes, fileIcon, deptLabel, setDeptLabel } from '../utils/helpers';
import Spinner from '../components/Spinner';

const SEMESTERS = ['1st Semester','2nd Semester','3rd Semester','4th Semester','5th Semester','6th Semester','7th Semester','8th Semester','9th Semester','10th Semester'];

export default function Notes() {
  const { scope } = useScope();
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [allSubjects, setAllSubjects] = useState([]);
  const [notes, setNotes] = useState(null);
  const [noteDepts, setNoteDepts] = useState([]);
  const [formData, setFormData] = useState({
    title: '', description: '', department: '', semester: '', subject_id: '',
    submitted_by: '', submitted_email: ''
  });
  const [formFile, setFormFile] = useState(null);
  const [submitAlert, setSubmitAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef(null);
  const { hash } = useLocation();

  // Scroll to #submit when navigating here from another page
  useEffect(() => {
    if (!hash) return;
    const id = hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Element may not be in DOM yet - retry after render
      const t = setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(t);
    }
  }, [hash]);

  useEffect(() => {
    fetch('/api/admin/departments')
      .then(r => r.json())
      .then(d => {
        const depts = d.departments || [];
        setNoteDepts(depts);
        depts.forEach(dep => setDeptLabel(dep.code, dep.name));
      })
      .catch(() => {});

    fetch('/api/subjects')
      .then(r => r.json())
      .then(d => setAllSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  function filterSubjects(department, semester) {
    const dept = (department || '').toLowerCase();
    return allSubjects.filter(s => {
      if (dept && s.department !== dept) return false;
      if (semester && s.semester !== semester) return false;
      return true;
    });
  }

  const filteredScopeSubjects = filterSubjects(scope.department, scope.semester);
  const filteredFormSubjects = filterSubjects(formData.department, formData.semester);

  const loadNotes = useCallback(() => {
    const params = new URLSearchParams();
    if (subjectFilter) params.set('subject_id', subjectFilter);
    const sem = semesterFilter || scope.semester;
    if (sem) params.set('semester', sem);
    if (scope.department) params.set('department', scope.department);

    setNotes(null);
    fetch('/api/notes?' + params.toString(), { credentials: 'omit' })
      .then(r => r.json())
      .then(d => {
        let list = d.notes || [];
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          list = list.filter(n =>
            (n.title || '').toLowerCase().includes(q) ||
            (n.description || '').toLowerCase().includes(q) ||
            (n.subject_name || '').toLowerCase().includes(q)
          );
        }
        setNotes(list);
      })
      .catch(() => setNotes([]));
  }, [subjectFilter, semesterFilter, scope.semester, scope.department, search]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadNotes, 300);
    return () => clearTimeout(debounceRef.current);
  }, [loadNotes]);

  function resetFilters() {
    setSearch('');
    setSubjectFilter('');
    setSemesterFilter('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitAlert(null);
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('department', formData.department);
      fd.append('semester', formData.semester);
      fd.append('subject_id', formData.subject_id);
      fd.append('submitted_by', formData.submitted_by);
      fd.append('submitted_email', formData.submitted_email);
      fd.append('file', formFile);

      const res = await fetch('/api/notes', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setSubmitAlert({ type: 'success', msg: data.message || 'Submitted!' });
        setFormData({ title: '', description: '', department: '', semester: '', subject_id: '', submitted_by: '', submitted_email: '' });
        setFormFile(null);
        e.target.reset();
        loadNotes();
      } else {
        setSubmitAlert({ type: 'error', msg: data.error || 'Submission failed' });
      }
    } catch {
      setSubmitAlert({ type: 'error', msg: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="page-header">
        <div className="container">
          <div className="breadcrumb"><Link to="/">Home</Link> › Notes</div>
          <h1>Student Notes</h1>
          <p>Notes contributed by students and approved by the department's teachers.</p>
        </div>
      </section>

      <main>
        <div className="container">
          <div className="filter-bar">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes..."
            />
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="">All Subjects</option>
              {filteredScopeSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.semester}</option>
              ))}
            </select>
            <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)}>
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn btn-secondary" onClick={resetFilters}>Reset</button>
            <button className="btn btn-primary" onClick={() => document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              + Submit Note
            </button>
          </div>

          <div className="section-bar">
            <h2 className="section-title" style={{ margin: 0, padding: 0 }}>Approved Notes</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {notes !== null ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} found` : ''}
            </span>
          </div>

          <div id="notesContainer">
            {notes === null ? (
              <Spinner />
            ) : notes.length === 0 ? (
              <div className="empty-state">
                <div className="icon">N</div>
                <h3>No notes found</h3>
                <p>Be the first to share study notes for this subject.</p>
              </div>
            ) : (
              <div className="manuals-grid">
                {notes.map(n => <NoteCard key={n.id} n={n} />)}
              </div>
            )}
          </div>

          <section id="submit" style={{ marginTop: 48 }}>
            <h2 className="section-title">Submit Your Notes</h2>
            <p className="section-subtitle">Share your study material with classmates. A teacher will review it before it appears in the public list.</p>

            <div className="card" style={{ maxWidth: 720 }}>
              <div className="card-body">
                {submitAlert && (
                  <div className={`alert alert-${submitAlert.type}`}>{submitAlert.msg}</div>
                )}
                <form onSubmit={handleSubmit} encType="multipart/form-data">
                  <div className="form-group">
                    <label>Note Title *</label>
                    <input type="text" required placeholder="e.g. Thermodynamics Unit 3 - summary notes"
                      value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea placeholder="What's in these notes?"
                      value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Department *</label>
                      <select required value={formData.department}
                        onChange={e => setFormData(f => ({ ...f, department: e.target.value, subject_id: '' }))}>
                        <option value="">- Select -</option>
                        {noteDepts.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Semester *</label>
                      <select required value={formData.semester}
                        onChange={e => setFormData(f => ({ ...f, semester: e.target.value, subject_id: '' }))}>
                        <option value="">- Select -</option>
                        {SEMESTERS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Subject</label>
                      <select value={formData.subject_id}
                        onChange={e => setFormData(f => ({ ...f, subject_id: e.target.value }))}>
                        {filteredFormSubjects.length === 0 && (formData.department || formData.semester) ? (
                          <option value="">- No subjects for this department / semester -</option>
                        ) : (
                          <>
                            <option value="">- Select -</option>
                            {filteredFormSubjects.map(s => (
                              <option key={s.id} value={s.id}>{s.name} - {s.semester}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Submitted By *</label>
                      <input type="text" required placeholder="Your name"
                        value={formData.submitted_by} onChange={e => setFormData(f => ({ ...f, submitted_by: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Email (optional)</label>
                      <input type="email" placeholder="you@example.com"
                        value={formData.submitted_email} onChange={e => setFormData(f => ({ ...f, submitted_email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>File * <small>(PDF, DOC, DOCX, PPT, ZIP - max 50 MB)</small></label>
                    <input type="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
                      onChange={e => setFormFile(e.target.files[0])} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Note for Review'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function NoteCard({ n }) {
  return (
    <article className="manual-card">
      <div className="manual-card-top" style={{ background: 'linear-gradient(135deg, var(--primary), #335a96)' }}>
        <div className="manual-icon">{fileIcon(n.file_type)}</div>
        <h3>{n.title}</h3>
        <div className="meta">{n.subject_name || n.subject || 'Note'} • {n.semester}</div>
      </div>
      <div className="manual-card-body">
        <p className="desc">
          {(n.description || 'No description provided.').slice(0, 150)}
          {(n.description || '').length > 150 ? '…' : ''}
        </p>
        <div className="manual-meta-row">
          <span className="manual-tag">{deptLabel(n.department)}</span>
          <span className="manual-tag">{(n.file_type || '').toUpperCase()}</span>
          <span className="manual-tag">{formatBytes(n.file_size)}</span>
          <span className="manual-tag">{n.submitted_by || 'Student'}</span>
        </div>
      </div>
      <div className="manual-card-footer">
        <span className="download-count">{formatDate(n.created_at)}</span>
        <a href={`/api/notes/${n.id}/download`} className="btn btn-primary btn-sm">Download</a>
      </div>
    </article>
  );
}
