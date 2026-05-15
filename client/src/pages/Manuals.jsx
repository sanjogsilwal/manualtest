import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate, formatBytes, fileIcon, deptLabel, setDeptLabel } from '../utils/helpers';
import Spinner from '../components/Spinner';
import PdfViewer from '../components/PdfViewer';

const SEMESTERS = ['1st Semester','2nd Semester','3rd Semester','4th Semester','5th Semester','6th Semester','7th Semester','8th Semester','9th Semester','10th Semester'];

export default function Manuals() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [manuals, setManuals] = useState(null);
  const [viewingManual, setViewingManual] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/departments')
      .then(r => r.json())
      .then(d => {
        const depts = d.departments || [];
        setDepartments(depts);
        depts.forEach(dep => setDeptLabel(dep.code, dep.name));
      })
      .catch(() => {});

    fetch('/api/admin/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {});

    fetch('/api/subjects')
      .then(r => r.json())
      .then(d => setSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  // Subjects narrowed by the currently-selected department and semester.
  const visibleSubjects = useMemo(() => {
    const dept = (departmentFilter || '').toLowerCase();
    return subjects.filter(s => {
      if (dept && s.department !== dept) return false;
      if (semesterFilter && s.semester !== semesterFilter) return false;
      return true;
    });
  }, [subjects, departmentFilter, semesterFilter]);

  // If the previously-selected subject is no longer in the visible set
  // (because dept/sem changed), clear it so we don't keep an invalid filter.
  useEffect(() => {
    if (!subjectFilter) return;
    if (!visibleSubjects.some(s => String(s.id) === String(subjectFilter))) {
      setSubjectFilter('');
    }
  }, [visibleSubjects, subjectFilter]);

  const loadManuals = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (departmentFilter) params.set('department', departmentFilter);
    if (semesterFilter) params.set('semester', semesterFilter);
    if (subjectFilter) params.set('subject_id', subjectFilter);
    if (categoryFilter) params.set('category', categoryFilter);

    setManuals(null);
    fetch('/api/manuals?' + params.toString(), { credentials: 'omit' })
      .then(r => r.json())
      .then(d => setManuals(d.manuals || []))
      .catch(() => setManuals([]));
  }, [search, departmentFilter, semesterFilter, subjectFilter, categoryFilter]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadManuals, 300);
    return () => clearTimeout(debounceRef.current);
  }, [loadManuals]);

  function resetFilters() {
    setSearch('');
    setDepartmentFilter('');
    setSemesterFilter('');
    setSubjectFilter('');
    setCategoryFilter('');
  }

  return (
    <>
      <section className="page-header">
        <div className="container">
          <div className="breadcrumb"><Link to="/">Home</Link> › Lab Manuals</div>
          <h1>Lab Manuals &amp; Tutorials</h1>
          <p>Browse, search and download laboratory manuals approved by the department.</p>
        </div>
      </section>

      <main>
        <div className="container">
          <div className="filter-bar">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or keyword..."
            />
            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
            <select
              value={semesterFilter}
              onChange={e => setSemesterFilter(e.target.value)}
              aria-label="Filter by semester"
            >
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
            </select>
            <select
              value={subjectFilter}
              onChange={e => setSubjectFilter(e.target.value)}
              aria-label="Filter by subject"
            >
              <option value="">All Subjects</option>
              {visibleSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} - {s.semester}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={resetFilters}>Reset</button>
          </div>

          <div className="section-bar">
            <h2 className="section-title" style={{ margin: 0, padding: 0 }}>All Manuals</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {manuals !== null ? `${manuals.length} ${manuals.length === 1 ? 'manual' : 'manuals'} found` : ''}
            </span>
          </div>

          <div id="manualsContainer">
            {manuals === null ? (
              <Spinner />
            ) : manuals.length === 0 ? (
              <div className="empty-state">
                <div className="icon">M</div>
                <h3>No manuals found</h3>
                <p>Try adjusting the filters above, or click Reset to clear them all.</p>
              </div>
            ) : (
              <div className="manuals-grid">
                {manuals.map(m => (
                  <ManualCard key={m.id} m={m} onView={setViewingManual} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <PdfViewer manual={viewingManual} onClose={() => setViewingManual(null)} />
    </>
  );
}

function ManualCard({ m, onView }) {
  const isPdf = m.file_type === 'pdf';
  return (
    <article className="manual-card">
      <div className="manual-card-top">
        <div className="manual-icon">{fileIcon(m.file_type)}</div>
        <h3>{m.title}</h3>
        <div className="meta">{m.subject || m.category_name || 'Uncategorized'}{m.semester ? ' • ' + m.semester : ''}</div>
      </div>
      <div className="manual-card-body">
        <p className="desc">
          {(m.description || 'No description provided.').slice(0, 150)}
          {(m.description || '').length > 150 ? '…' : ''}
        </p>
        <div className="manual-meta-row">
          <span className="manual-tag">{deptLabel(m.department) || '-'}</span>
          {m.subject_name && <span className="manual-tag">{m.subject_name}</span>}
          <span className="manual-tag">{(m.file_type || '').toUpperCase()}</span>
          <span className="manual-tag">{formatBytes(m.file_size)}</span>
          <span className="manual-tag">{formatDate(m.created_at)}</span>
        </div>
      </div>
      <div className="manual-card-footer">
        <span className="download-count">{m.download_count} downloads</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isPdf && (
            <button className="btn btn-secondary btn-sm" onClick={() => onView(m)}>
              View PDF
            </button>
          )}
          <a href={`/api/manuals/${m.id}/download`} className="btn btn-primary btn-sm">Download</a>
        </div>
      </div>
    </article>
  );
}
