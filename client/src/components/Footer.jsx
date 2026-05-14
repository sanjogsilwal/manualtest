import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer" id="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo-row">
              <img
                className="brand-logo"
                src="/images/tu-logo.jpeg"
                alt="Tribhuvan University"
                style={{ width: 40, height: 40 }}
                onError={e => { e.target.outerHTML = '<div class="brand-logo placeholder" style="width:40px;height:40px;font-size:14px;">TU</div>'; }}
              />
              <h4>Department of Automobile<br />And Mechanical Engineering</h4>
            </div>
            <p>This department fosters excellence in teaching, research, and innovation, preparing students for successful careers in applied sciences.</p>
          </div>
          <div className="footer-col">
            <h4>Quick Access</h4>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/manuals">Lab Manuals</Link></li>
              <li><Link to="/notes">Notes</Link></li>
              <li><Link to="/notes#submit">Submit Notes</Link></li>
              <li><Link to="/login">Login</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="https://lms.tcioe.edu.np" target="_blank" rel="noopener noreferrer">LMS</a></li>
              <li><a href="https://routine.tcioe.edu.np" target="_blank" rel="noopener noreferrer">Routine</a></li>
              <li><a href="https://library.tcioe.edu.np" target="_blank" rel="noopener noreferrer">Library</a></li>
              <li><a href="http://tcioe.edu.np/notices" target="_blank" rel="noopener noreferrer">Notices</a></li>
              <li><a href="http://tcioe.edu.np" target="_blank" rel="noopener noreferrer">Main Campus Site</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Get In Touch</h4>
            <div className="contact-line"><span className="ic">Email</span><span>doame@tcioe.edu.np</span></div>
            <div className="contact-line"><span className="ic">Phone</span><span>+977-1-5971483</span></div>
            <div className="contact-line"><span className="ic">Address</span><span>Thapathali Campus, Kathmandu</span></div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Thapathali Campus — Department of Automobile And Mechanical Engineering</span>
          <span className="footer-status"><span className="dot"></span>System Online</span>
        </div>
      </div>
    </footer>
  );
}
