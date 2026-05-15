import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../components/Spinner';

export default function Home() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [manualsRes, notesRes] = await Promise.all([
          fetch('/api/manuals', { credentials: 'omit' }),
          fetch('/api/notes',   { credentials: 'omit' })
        ]);
        const manualsData = await manualsRes.json();
        const notesData = await notesRes.json();

        const combined = [
          ...manualsData.manuals.slice(0, 3).map(m => ({
            type: 'Lab Manual',
            title: m.title,
            description: (m.description || 'Lab manual for the department.').slice(0, 110),
            link: `/api/manuals/${m.id}/download`,
            linkText: 'Download'
          })),
          ...notesData.notes.filter(n => n.status === 'approved').slice(0, 3).map(n => ({
            type: 'Student Note',
            title: n.title,
            description: (n.description || 'Student-contributed note.').slice(0, 110),
            link: `/api/notes/${n.id}/download`,
            linkText: 'Download'
          }))
        ].slice(0, 3);

        setItems(combined);
      } catch {
        setItems([]);
      }
    }
    load();
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>LearnSpace</h1>
          <p>The official platform for lab manuals, course tutorials and student-contributed notes - organised by department, semester and subject for every learner at Thapathali Campus.</p>
          <div className="hero-actions">
            <Link to="/manuals" className="btn btn-primary">Browse Lab Manuals</Link>
            <Link to="/notes" className="btn btn-outline">View Notes</Link>
          </div>
        </div>
      </section>

      <main>
        <div className="container">
          <section className="section">
            <h2 className="section-title">What's inside</h2>
            <div className="feature-grid">
              <div className="feature-box">
                <h3>Lab Manuals</h3>
                <p>Department-approved laboratory manuals for every subject and semester, available for download.</p>
                <Link to="/manuals" className="btn btn-link">View Manuals</Link>
              </div>
              <div className="feature-box">
                <h3>Student Notes</h3>
                <p>Notes shared by classmates, reviewed and approved by faculty before they appear here.</p>
                <Link to="/notes" className="btn btn-link">View Notes</Link>
              </div>
              <div className="feature-box">
                <h3>Submit Your Notes</h3>
                <p>Help your peers - submit your notes for review. Approved notes are published in the public library.</p>
                <Link to="/notes#submit" className="btn btn-link">Submit Notes</Link>
              </div>
            </div>
          </section>

          <section className="section" style={{ borderTop: '1px solid var(--border)', paddingTop: 50 }}>
            <span className="section-eyebrow">Resources &amp; Library</span>
            <h2 className="section-title">Recently added study material</h2>
            <p className="section-subtitle">Lab manuals and approved notes from across the departments, all in one place.</p>

            <div className="research-grid" id="recentlyAdded">
              {items === null ? (
                <>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="research-card">
                      <span className="tag">Loading</span>
                      <h3>Fetching recent materials…</h3>
                      <p>Hold on while we get the latest manuals and notes.</p>
                    </div>
                  ))}
                </>
              ) : items.length === 0 ? (
                <div className="research-card" style={{ gridColumn: '1 / -1' }}>
                  <h3>No materials uploaded yet</h3>
                  <p>Once a teacher uploads a manual or a student submits an approved note, it will appear here.</p>
                  <Link to="/manuals" className="btn btn-link">Browse Library</Link>
                </div>
              ) : (
                items.map((it, i) => (
                  <div key={i} className="research-card">
                    <span className="tag">{it.type}</span>
                    <h3>{it.title}</h3>
                    <p>{it.description}…</p>
                    <a href={it.link} className="btn btn-link">{it.linkText}</a>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="section" style={{ background: 'var(--bg-soft)', margin: '0 -24px', padding: '50px 24px', borderRadius: 'var(--radius)' }}>
            <span className="section-eyebrow">Contributions</span>
            <h2 className="section-title">Share Your Work</h2>
            <p className="section-subtitle">Students and faculty can submit notes and lab materials. Submissions are reviewed by a teacher before publishing.</p>

            <div className="submit-grid">
              <div className="submit-card">
                <h3>Submit Note</h3>
                <p className="desc">Share notes you've prepared with classmates from your department and semester.</p>
                <ul className="check-list">
                  <li>Title and description</li>
                  <li>Department, semester and subject</li>
                  <li>PDF / DOC / PPT (max 50 MB)</li>
                </ul>
                <Link to="/notes#submit" className="btn btn-link">Submit Note</Link>
              </div>
              <div className="submit-card">
                <h3>Upload Lab Manual</h3>
                <p className="desc">Faculty and admins can upload approved laboratory manuals for any subject.</p>
                <ul className="check-list">
                  <li>Department-tagged</li>
                  <li>Linked to a subject and semester</li>
                  <li>Public or Private visibility</li>
                </ul>
                <Link to="/login" className="btn btn-link">Faculty Login</Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
