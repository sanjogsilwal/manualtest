import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useScope } from '../contexts/ScopeContext';

const SEMESTERS = [
  '1st Semester','2nd Semester','3rd Semester','4th Semester',
  '5th Semester','6th Semester','7th Semester','8th Semester'
];

export default function Header() {
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const { scope, departments, updateDepartment, updateSemester } = useScope();

  const page = location.pathname === '/' ? 'home'
    : location.pathname === '/about' ? 'about'
    : location.pathname === '/manuals' ? 'manuals'
    : location.pathname === '/notes' ? 'notes'
    : location.pathname === '/login' ? 'login'
    : '';

  const showScopeBar = page === 'manuals' || page === 'notes';

  function isActive(p) {
    return page === p ? 'active' : '';
  }

  function handleNavLinkClick() {
    setNavOpen(false);
  }

  return (
    <header className="site-header" id="site-header">
      <div className="header-main">
        <div className="container">
          <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
            <img
              className="brand-logo"
              src="/images/tu-logo.jpeg"
              alt="Tribhuvan University"
              onError={e => { e.target.outerHTML = '<div class="brand-logo placeholder">TU</div>'; }}
            />
            <div className="brand-text">
              <span className="uni">Tribhuvan University</span>
              <h1>Department of Automobile And Mechanical Engineering</h1>
              <span className="campus">Thapathali Campus</span>
            </div>
          </Link>
          <div className="accreditation">
            <img
              src="/images/ugc-logo.jpeg"
              alt="UGC Nepal"
              onError={e => { e.target.outerHTML = '<div class="accreditation-badge">UGC</div>'; }}
            />
            <div className="accreditation-text">
              <strong>Accredited by University Grants Commission</strong>
              <span className="small">(UGC) Nepal</span>
              <span className="small">Quality Education Since 1930 A.D.</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="main-nav">
        <div className="container nav-container">
          <button
            className={`nav-toggle${navOpen ? ' open' : ''}`}
            id="navToggle"
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(o => !o)}
          >
            {navOpen ? '✕ Close' : '☰ Menu'}
          </button>
          <ul className={`nav-list${navOpen ? ' open' : ''}`}>
            <li><Link to="/" className={isActive('home')} onClick={handleNavLinkClick}>Home</Link></li>
            <li><Link to="/about" className={isActive('about')} onClick={handleNavLinkClick}>About</Link></li>
            <li><Link to="/manuals" className={isActive('manuals')} onClick={handleNavLinkClick}>Lab Manuals</Link></li>
            <li><Link to="/notes" className={isActive('notes')} onClick={handleNavLinkClick}>Notes</Link></li>
            <li><Link to="/notes#submit" onClick={handleNavLinkClick}>Submit Notes</Link></li>
            <li><a href="http://tcioe.edu.np" target="_blank" rel="noopener noreferrer">Main Campus</a></li>
            <li><Link to="/login" className={isActive('login')} onClick={handleNavLinkClick}>Login</Link></li>
          </ul>
        </div>
      </nav>

      {showScopeBar && (
        <div className="scope-bar">
          <div className="container">
            <label>Show resources for</label>
            <select
              id="scopeDept"
              value={scope.department}
              onChange={e => updateDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </select>
            <select
              id="scopeSem"
              value={scope.semester}
              onChange={e => updateSemester(e.target.value)}
            >
              <option value="">All Semesters</option>
              {SEMESTERS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="hint">Filters lab manuals and notes by your department and semester</span>
          </div>
        </div>
      )}
    </header>
  );
}
