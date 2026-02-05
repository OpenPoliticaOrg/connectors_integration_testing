export interface Workspace {
  id: string;
  workspace_name: string;
  is_active: boolean;
  connected_at: string;
  last_updated: string;
}

export interface Conversation {
  id: string;
  current_state: ConversationState;
  last_activity_at: string;
  summary?: string;
  owner_id?: string;
}

export type ConversationState = 
  | 'idle'
  | 'question_raised'
  | 'clarifying'
  | 'owner_assigned'
  | 'in_progress'
  | 'resolved';

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  intent?: string;
  topic?: string;
  needs_owner?: boolean;
}

export interface StateTransition {
  from_state: string;
  to_state: string;
  trigger: string;
  timestamp: string;
}

export interface TeamAnalytics {
  workspace_id: string;
  period_start: string;
  period_end: string;
  metrics: {
    avg_time_to_clarity_hours?: number;
    avg_time_to_ownership_hours?: number;
    avg_time_to_resolution_hours?: number;
    clarification_loops: number;
    drop_off_rate: number;
  };
  totals: {
    conversations: number;
    resolved: number;
  };
  gaps: {
    ownership: number;
    context: number;
    response: number;
    resolution: number;
  };
}

export interface CommunicationGap {
  id: string;
  gap_type: string;
  severity: number;
  description: string;
  detected_at: string;
  is_resolved: boolean;
}

export interface OAuthInstallUrl {
  install_url: string;
  scopes: string[];
  state: string;
}

export interface UserAnalytics {
  user_id: string;
  response_latency_avg?: number;
  issues_unblocked: number;
  context_contributions: number;
}
