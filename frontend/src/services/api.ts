import axios from 'axios';
import type {
  Workspace,
  Conversation,
  Message,
  TeamAnalytics,
  OAuthInstallUrl,
} from '../types';

// API Base URL - configurable via environment variable
// For local dev: /api/v1 (uses Vite proxy)
// For ngrok: https://xxxx.ngrok-free.app/api/v1
// For production: https://your-domain.com/api/v1
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[API] Unauthorized - redirecting to login');
      // Could redirect to login page here
    }
    return Promise.reject(error);
  }
);

export const oauthApi = {
  getInstallUrl: async (): Promise<OAuthInstallUrl> => {
    const response = await api.get('/oauth/install');
    return response.data;
  },

  getStatus: async (workspaceId: string): Promise<Workspace> => {
    const response = await api.get(`/oauth/status/${workspaceId}`);
    return response.data;
  },

  revoke: async (workspaceId: string): Promise<void> => {
    await api.get(`/oauth/revoke/${workspaceId}`);
  },
};

export const conversationApi = {
  getConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await api.get(`/conversations/${conversationId}`);
    return response.data;
  },

  getMessages: async (
    conversationId: string,
    limit = 50,
    offset = 0
  ): Promise<Message[]> => {
    const response = await api.get(
      `/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
    );
    return response.data.messages;
  },

  getStateHistory: async (conversationId: string): Promise<any[]> => {
    const response = await api.get(`/conversations/${conversationId}/history`);
    return response.data.history;
  },

  getActiveConversations: async (
    workspaceId: string,
    states?: string[]
  ): Promise<Conversation[]> => {
    const params = new URLSearchParams();
    params.append('workspace_id', workspaceId);
    if (states) {
      states.forEach(s => params.append('states', s));
    }
    const response = await api.get(
      `/conversations/workspace/active?${params.toString()}`
    );
    return response.data.conversations;
  },
};

export const analyticsApi = {
  getTeamAnalytics: async (
    workspaceId: string,
    startDate: string,
    endDate: string
  ): Promise<TeamAnalytics> => {
    const response = await api.get(
      `/analytics/team/${workspaceId}?start_date=${startDate}&end_date=${endDate}`
    );
    return response.data;
  },

  detectGaps: async (conversationId: string): Promise<any[]> => {
    const response = await api.get(`/analytics/gaps/${conversationId}`);
    return response.data.gaps;
  },
};

export const assistantApi = {
  query: async (
    query: string,
    workspaceId: string
  ): Promise<any> => {
    const response = await api.post('/assistant/query', {
      query,
      workspace_id: workspaceId,
    });
    return response.data;
  },

  submitFeedback: async (
    query: string,
    response: string,
    rating: number,
    feedbackText?: string
  ): Promise<void> => {
    await api.post('/assistant/feedback', {
      query,
      response,
      rating,
      feedback_text: feedbackText,
    });
  },
};

export default api;
