import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main>
      <div className="container">
        <div className="empty-state" style={{ margin: '60px auto', maxWidth: 600 }}>
          <div className="icon" style={{ fontSize: 56, color: 'var(--text-light)' }}>404</div>
          <h3 style={{ fontSize: 28, color: 'var(--primary)' }}>404 - Page Not Found</h3>
          <p style={{ margin: '14px 0 24px' }}>The page you are looking for does not exist or may have been moved.</p>
          <Link to="/" className="btn btn-primary">Return to Home</Link>
          <Link to="/manuals" className="btn btn-secondary" style={{ marginLeft: 10 }}>Browse Manuals</Link>
        </div>
      </div>
    </main>
  );
}
