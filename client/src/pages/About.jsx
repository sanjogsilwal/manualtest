import { Link } from 'react-router-dom';

export default function About() {
  return (
    <>
      <section className="page-header">
        <div className="container">
          <div className="breadcrumb"><Link to="/">Home</Link> › About Us</div>
          <h1>About Us</h1>
          <p>Campus Study Hub — IOE Thapathali Campus</p>
        </div>
      </section>

      <main>
        <div className="container">
          <div className="about-content">
            <h2>About this Platform</h2>
            <p><strong>Campus Study Hub</strong> is the official online repository of laboratory manuals, course tutorials and student-contributed notes for the departments of the Institute of Engineering, Thapathali Campus.</p>
            <p>The platform is designed around the way teaching is organised at the campus: every resource is linked to a <strong>department</strong>, a <strong>semester</strong> and a <strong>subject</strong>, so students always see what is relevant to them. Faculty and admins can add new departments and subjects, upload approved manuals, and review notes submitted by students before they are published.</p>

            <h2>What you can do here</h2>
            <ul>
              <li><strong>Browse lab manuals</strong> uploaded and verified by department faculty.</li>
              <li><strong>Read student notes</strong> that have been reviewed and approved by a teacher.</li>
              <li><strong>Submit your own notes</strong> for review and help fellow students.</li>
              <li><strong>Filter by department and semester</strong> so you only see what applies to your course.</li>
              <li><strong>Public/Private resources</strong> — public materials are open to everyone, private ones require login.</li>
            </ul>

            <h2>Who built this</h2>
            <div className="about-creators">
              This platform was created by <strong>Dipendra Kafle</strong> and <strong>Sanjog Silwal</strong> during their tenure as Teaching/Instructor Assistants (T/IA) in the Department of Automobile and Mechanical Engineering, IOE Thapathali Campus.
              <br /><br />
              The aim was to provide a single, official, well-organised home for all departmental study material, replacing the scattered email attachments and shared drives that students had relied on previously. The system is now maintained by the department's faculty and admins.
            </div>

            <h2>Contact</h2>
            <p>
              <strong>Department of Automobile and Mechanical Engineering</strong><br />
              Institute of Engineering, Thapathali Campus<br />
              Tribhuvan University<br />
              Thapathali, Kathmandu, Nepal — 44600<br />
              Tel: +977-1-4-256-262<br />
              Web: <a href="http://tcioe.edu.np" target="_blank" rel="noopener noreferrer">tcioe.edu.np</a>
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
