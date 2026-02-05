import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Workspace } from '../types';
import { oauthApi } from '../services/api';

interface AppContextType {
  workspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
  setWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspace: () => Promise<void>;
  disconnectWorkspace: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedWorkspaceId = localStorage.getItem('workspace_id');
    if (storedWorkspaceId) {
      refreshWorkspace();
    } else {
      setIsLoading(false);
    }
  }, []);

  const refreshWorkspace = async () => {
    const storedWorkspaceId = localStorage.getItem('workspace_id');
    if (!storedWorkspaceId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const ws = await oauthApi.getStatus(storedWorkspaceId);
      setWorkspace(ws);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch workspace:', err);
      localStorage.removeItem('workspace_id');
      setWorkspace(null);
      setError('Failed to load workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWorkspace = async () => {
    if (!workspace) return;

    try {
      await oauthApi.revoke(workspace.id);
      localStorage.removeItem('workspace_id');
      setWorkspace(null);
    } catch (err) {
      console.error('Failed to revoke access:', err);
      setError('Failed to disconnect workspace');
    }
  };

  return (
    <AppContext.Provider
      value={{
        workspace,
        isLoading,
        error,
        setWorkspace: (ws) => {
          if (ws) {
            localStorage.setItem('workspace_id', ws.id);
          } else {
            localStorage.removeItem('workspace_id');
          }
          setWorkspace(ws);
        },
        refreshWorkspace,
        disconnectWorkspace,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
