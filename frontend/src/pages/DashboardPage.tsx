import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { conversationApi, analyticsApi } from '../services/api';
import type { Conversation, TeamAnalytics } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { workspace, isLoading, disconnectWorkspace } = useApp();
  const [activeConversations, setActiveConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !workspace) {
      navigate('/login');
      return;
    }

    if (workspace) {
      loadData();
    }
  }, [workspace, isLoading]);

  const loadData = async () => {
    if (!workspace) return;

    setLoading(true);
    try {
      const [convs, analyticsData] = await Promise.all([
        conversationApi.getActiveConversations(workspace.workspace_id),
        analyticsApi.getTeamAnalytics(
          workspace.workspace_id,
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          new Date().toISOString()
        ),
      ]);
      setActiveConversations(convs);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect this workspace?')) {
      await disconnectWorkspace();
      navigate('/login');
    }
  };

  if (isLoading || loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  if (!workspace) {
    return null;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Dashboard</h1>
          <div style={styles.workspaceInfo}>
            <span style={styles.workspaceName}>{workspace.workspace_name}</span>
            <span className="badge badge-success">Connected</span>
          </div>
        </div>
        <button onClick={handleDisconnect} style={styles.disconnectBtn}>
          Disconnect
        </button>
      </header>

      <main style={styles.main}>
        <section style={styles.metricsSection}>
          <h2 style={styles.sectionTitle}>Team Metrics (Last 7 Days)</h2>
          {analytics ? (
            <div style={styles.metricsGrid}>
              <MetricCard
                label="Total Conversations"
                value={analytics.totals.conversations}
                icon="💬"
              />
              <MetricCard
                label="Resolved"
                value={analytics.totals.resolved}
                icon="✅"
              />
              <MetricCard
                label="Avg Time to Ownership"
                value={analytics.metrics.avg_time_to_ownership_hours?.toFixed(1) + 'h'}
                icon="👤"
              />
              <MetricCard
                label="Avg Time to Resolution"
                value={analytics.metrics.avg_time_to_resolution_hours?.toFixed(1) + 'h'}
                icon="⏱️"
              />
              <MetricCard
                label="Clarification Loops"
                value={analytics.metrics.clarification_loops}
                icon="🔄"
              />
              <MetricCard
                label="Drop-off Rate"
                value={(analytics.metrics.drop_off_rate * 100).toFixed(1) + '%'}
                icon="📉"
              />
            </div>
          ) : (
            <p style={styles.noData}>No analytics data available yet.</p>
          )}
        </section>

        <section style={styles.conversationsSection}>
          <h2 style={styles.sectionTitle}>Active Conversations</h2>
          {activeConversations.length > 0 ? (
            <div style={styles.conversationsList}>
              {activeConversations.map((conv) => (
                <ConversationCard key={conv.id} conversation={conv} />
              ))}
            </div>
          ) : (
            <div style={styles.emptyState}>
              <p>No active conversations yet.</p>
              <p style={styles.emptyNote}>
                Add the bot to your Slack channels to start tracking.
              </p>
            </div>
          )}
        </section>

        <section style={styles.gapsSection}>
          <h2 style={styles.sectionTitle}>Communication Gaps</h2>
          {analytics && (
            <div style={styles.gapsGrid}>
              <GapCard type="ownership" count={analytics.gaps.ownership} />
              <GapCard type="context" count={analytics.gaps.context} />
              <GapCard type="response" count={analytics.gaps.response} />
              <GapCard type="resolution" count={analytics.gaps.resolution} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricIcon}>{icon}</span>
      <span style={styles.metricValue}>{value}</span>
      <span style={styles.metricLabel}>{label}</span>
    </div>
  );
}

function ConversationCard({ conversation }: { conversation: Conversation }) {
  const stateColors: Record<string, string> = {
    idle: 'var(--gray-400)',
    question_raised: 'var(--warning)',
    clarifying: 'var(--warning)',
    owner_assigned: 'var(--primary)',
    in_progress: 'var(--primary)',
    resolved: 'var(--secondary)',
  };

  return (
    <div style={styles.conversationCard}>
      <div style={styles.conversationHeader}>
        <span
          style={{
            ...styles.stateDot,
            backgroundColor: stateColors[conversation.current_state] || 'var(--gray-400)',
          }}
        />
        <span style={styles.conversationState}>
          {conversation.current_state.replace('_', ' ')}
        </span>
        <span style={styles.conversationTime}>
          {new Date(conversation.last_activity_at).toLocaleDateString()}
        </span>
      </div>
      {conversation.summary && (
        <p style={styles.conversationSummary}>{conversation.summary}</p>
      )}
    </div>
  );
}

function GapCard({ type, count }: { type: string; count: number }) {
  const gapInfo: Record<string, { label: string; icon: string }> = {
    ownership: { label: 'Ownership Gaps', icon: '👤' },
    context: { label: 'Context Gaps', icon: '📝' },
    response: { label: 'Response Gaps', icon: '⏰' },
    resolution: { label: 'Resolution Gaps', icon: '🎯' },
  };

  const info = gapInfo[type] || { label: type, icon: '⚠️' };

  return (
    <div style={styles.gapCard}>
      <span style={styles.gapIcon}>{info.icon}</span>
      <span style={styles.gapCount}>{count}</span>
      <span style={styles.gapLabel}>{info.label}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--gray-50)',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    fontSize: '1.25rem',
    color: 'var(--gray-500)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 2rem',
    backgroundColor: 'var(--white)',
    borderBottom: '1px solid var(--gray-200)',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--gray-900)',
  },
  workspaceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  workspaceName: {
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
  },
  disconnectBtn: {
    padding: '0.5rem 1rem',
    backgroundColor: 'var(--white)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: '0.375rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: 'var(--gray-800)',
    marginBottom: '1rem',
  },
  metricsSection: {
    marginBottom: '2rem',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem',
  },
  metricCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.5rem',
    backgroundColor: 'var(--white)',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  metricIcon: {
    fontSize: '1.5rem',
    marginBottom: '0.5rem',
  },
  metricValue: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--gray-900)',
  },
  metricLabel: {
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    textAlign: 'center',
  },
  noData: {
    color: 'var(--gray-500)',
    fontStyle: 'italic',
  },
  conversationsSection: {
    marginBottom: '2rem',
  },
  conversationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  conversationCard: {
    padding: '1rem 1.25rem',
    backgroundColor: 'var(--white)',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  conversationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  stateDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  conversationState: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--gray-700)',
    textTransform: 'capitalize',
  },
  conversationTime: {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    color: 'var(--gray-400)',
  },
  conversationSummary: {
    marginTop: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--gray-600)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '3rem',
    backgroundColor: 'var(--white)',
    borderRadius: '0.75rem',
    color: 'var(--gray-500)',
  },
  emptyNote: {
    fontSize: '0.875rem',
    marginTop: '0.5rem',
    color: 'var(--gray-400)',
  },
  gapsSection: {
    marginBottom: '2rem',
  },
  gapsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '1rem',
  },
  gapCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1.25rem',
    backgroundColor: 'var(--white)',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  gapIcon: {
    fontSize: '1.25rem',
    marginBottom: '0.25rem',
  },
  gapCount: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--gray-900)',
  },
  gapLabel: {
    fontSize: '0.75rem',
    color: 'var(--gray-500)',
    textAlign: 'center',
  },
};
