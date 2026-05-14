import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) navigate('/admin'); })
      .catch(() => {});
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAlert({ type: 'error', msg: data.error || 'Login failed' });
        return;
      }
      localStorage.setItem('user_token', data.token);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_info', JSON.stringify(data.user));
      navigate('/admin');
    } catch {
      setAlert({ type: 'error', msg: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="brand-logo">TU</div>
        <h2>Sign In</h2>
        <p className="subtitle">Department of Automobile &amp; Mechanical Engineering<br />IOE, Thapathali Campus</p>

        {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              type="text" id="username" name="username" required
              autoComplete="username" value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password" id="password" name="password" required
              autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          <Link to="/" style={{ color: 'var(--primary)' }}>← Back to Home</Link>
        </div>

        <div style={{ marginTop: 22, padding: 14, background: '#fff8e1', borderRadius: 6, fontSize: 12, color: '#874d00', borderLeft: '3px solid var(--warning)' }}>
          <strong>Note:</strong> Accounts (teacher / admin / super admin) are created by the main admins (Sanjog Silwal &amp; Dipendra Kafle). Students do not need an account — they can browse and submit notes anonymously.
        </div>
      </div>
    </div>
  );
}
