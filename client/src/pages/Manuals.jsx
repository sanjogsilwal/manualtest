import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatDate, formatBytes, fileIcon, deptLabel } from '../utils/helpers';
import Spinner from '../components/Spinner';
import PdfViewer from '../components/PdfViewer';

const SEMESTERS = ['1st Semester','2nd Semester','3rd Semester','4th Semester','5th Semester','6th Semester','7th Semester','8th Semester'];

export default function Manuals() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [manuals, setManuals] = useState(null);
  const [viewingManual, setViewingManual] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {});

    fetch('/api/subjects')
      .then(r => r.json())
      .then(d => setSubjects(d.subjects || []))
      .catch(() => {});
  }, []);

  const loadManuals = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryFilter) params.set('category', categoryFilter);
    if (subjectFilter) params.set('subject_id', subjectFilter);
    if (semesterFilter) params.set('semester', semesterFilter);

    setManuals(null);
    fetch('/api/manuals?' + params.toString(), { credentials: 'omit' })
      .then(r => r.json())
      .then(d => setManuals(d.manuals || []))
      .catch(() => setManuals([]));
  }, [search, categoryFilter, subjectFilter, semesterFilter]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadManuals, 300);
    return () => clearTimeout(debounceRef.current);
  }, [loadManuals]);

  function resetFilters() {
    setSearch('');
    setCategoryFilter('');
    setSubjectFilter('');
    setSemesterFilter('');
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
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.semester}</option>
              ))}
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)}>
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => <option key={s}>{s}</option>)}
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
                <p>Try changing the filters above or clearing your department/semester selection.</p>
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
          <span className="manual-tag">{deptLabel(m.department) || 'Both Depts'}</span>
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
