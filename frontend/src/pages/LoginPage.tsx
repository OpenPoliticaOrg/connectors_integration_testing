import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { oauthApi } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { workspace, isLoading } = useApp();
  const [installUrl, setInstallUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && workspace) {
      navigate('/dashboard');
    }
  }, [workspace, isLoading, navigate]);

  const handleConnectSlack = async () => {
    setLoading(true);
    setError(null);

    try {
      const urlData = await oauthApi.getInstallUrl();
      console.log('Got install URL:', urlData.install_url);
      setInstallUrl(urlData.install_url);
      window.location.href = urlData.install_url;
    } catch (err: any) {
      console.error('Failed to get install URL:', err);
      
      // Show more detailed error message
      let errorMessage = 'Failed to connect to Slack. Please try again.';
      
      if (err.response?.status === 500) {
        errorMessage = 'Server configuration error. Please check that Slack OAuth credentials are configured.';
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = `Connection error: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoSection}>
          <h1 style={styles.title}>Connect Your Workspace</h1>
          <p style={styles.subtitle}>
            Install the Slack app to start analyzing your team's communication patterns.
          </p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <button
          onClick={handleConnectSlack}
          disabled={loading}
          style={{
            ...styles.slackBtn,
            opacity: loading ? 0.7 : 1,
          }}
        >
          <SlackIcon style={styles.slackIcon} />
          {loading ? 'Connecting...' : 'Add to Slack'}
        </button>

        <div style={styles.permissions}>
          <h4 style={styles.permissionsTitle}>Required Permissions</h4>
          <ul style={styles.permissionsList}>
            <li>Read messages where the app is added</li>
            <li>View channel and user information</li>
            <li>Post messages (for assistant responses)</li>
            <li>Read when your team mentions the app</li>
          </ul>
          <p style={styles.permissionsNote}>
            We only read messages in channels where the app is installed.
            We never access private messages you're not part of.
          </p>
        </div>

        <div style={styles.backLink}>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

function SlackIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg style={{ ...styles.slackIcon, ...style }} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    backgroundColor: 'var(--gray-50)',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    backgroundColor: 'var(--white)',
    borderRadius: '1rem',
    padding: '2.5rem',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--gray-900)',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: 'var(--gray-600)',
  },
  loading: {
    fontSize: '1.25rem',
    color: 'var(--gray-500)',
  },
  error: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    marginBottom: '1.5rem',
    fontSize: '0.875rem',
  },
  slackBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '1rem',
    backgroundColor: '#4A154B',
    color: 'var(--white)',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  slackIcon: {
    width: '24px',
    height: '24px',
  },
  permissions: {
    marginTop: '2rem',
    paddingTop: '2rem',
    borderTop: '1px solid var(--gray-200)',
  },
  permissionsTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--gray-700)',
    marginBottom: '0.75rem',
  },
  permissionsList: {
    listStyle: 'none',
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
    marginBottom: '1rem',
  },
  permissionsNote: {
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    fontStyle: 'italic',
  },
  backLink: {
    textAlign: 'center',
    marginTop: '1.5rem',
    fontSize: '0.875rem',
  },
};
