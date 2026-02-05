import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { workspace, isLoading } = useApp();

  useEffect(() => {
    if (!isLoading && workspace) {
      navigate('/dashboard');
    }
  }, [workspace, isLoading, navigate]);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.logo}>Coordination Intelligence</div>
        <Link to="/login" style={styles.navLink}>Sign In</Link>
      </nav>

      <main style={styles.hero}>
        <h1 style={styles.title}>
          Understand How Your Team Communicates
        </h1>
        <p style={styles.subtitle}>
          Detect where collaboration breaks down. Improve productivity without
          invading privacy.
        </p>
        <div style={styles.cta}>
          <Link to="/login" className="btn btn-primary" style={styles.primaryBtn}>
            Get Started
          </Link>
          <a href="#features" style={styles.secondaryBtn}>
            Learn More
          </a>
        </div>
      </main>

      <section id="features" style={styles.features}>
        <div style={styles.featureCard}>
          <h3>Behavioral Intelligence</h3>
          <p>Understand communication patterns and identify bottlenecks automatically.</p>
        </div>
        <div style={styles.featureCard}>
          <h3>Coordination Analytics</h3>
          <p>Track time from question to resolution across your team.</p>
        </div>
        <div style={styles.featureCard}>
          <h3>Privacy First</h3>
          <p>Only analyzes work patterns, never individual performance scores.</p>
        </div>
      </section>

      <footer style={styles.footer}>
        <p>Built for teams that want to improve collaboration.</p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid var(--gray-200)',
    borderTopColor: 'var(--primary)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--gray-800)',
  },
  navLink: {
    fontWeight: 500,
  },
  hero: {
    textAlign: 'center',
    padding: '6rem 2rem',
    maxWidth: '800px',
    margin: '0 auto',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 700,
    color: 'var(--gray-900)',
    marginBottom: '1.5rem',
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: '1.25rem',
    color: 'var(--gray-600)',
    marginBottom: '2.5rem',
  },
  cta: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  primaryBtn: {
    padding: '1rem 2rem',
    fontSize: '1rem',
  },
  secondaryBtn: {
    padding: '1rem 2rem',
    fontSize: '1rem',
    color: 'var(--gray-700)',
    border: '1px solid var(--gray-300)',
    borderRadius: '0.5rem',
    backgroundColor: 'var(--white)',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '2rem',
    padding: '4rem 2rem',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  featureCard: {
    padding: '2rem',
    backgroundColor: 'var(--white)',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    color: 'var(--gray-500)',
    marginTop: 'auto',
  },
};
