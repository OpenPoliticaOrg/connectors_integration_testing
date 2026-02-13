import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface McpServerConfig {
  id: string;
  name: string;
  url: string;
  authToken?: string;
}

export interface ToolWithServer extends Tool {
  serverId: string;
  serverName: string;
}

export class McpClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, SSEClientTransport> = new Map();
  private tools: Map<string, ToolWithServer> = new Map();
  private authContexts: Map<string, { token: string; scopes: string[] }> = new Map();

  async connectServer(config: McpServerConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      console.log(`Already connected to ${config.name}`);
      return;
    }

    try {
      const transport = new SSEClientTransport(new URL(config.url));

      const client = new Client(
        {
          name: "ai-agent-backend",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      await client.connect(transport);

      this.clients.set(config.id, client);
      this.transports.set(config.id, transport);

      await this.discoverTools(config);

      console.log(`✅ Connected to ${config.name} MCP server`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.name}:`, error);
      throw error;
    }
  }

  private async discoverTools(config: McpServerConfig): Promise<void> {
    const client = this.clients.get(config.id);
    if (!client) return;

    try {
      const response = await client.listTools();

      for (const tool of response.tools) {
        const toolId = `${config.id}:${tool.name}`;
        this.tools.set(toolId, {
          ...tool,
          serverId: config.id,
          serverName: config.name,
        });
      }

      console.log(
        `📋 Discovered ${response.tools.length} tools from ${config.name}`,
      );
    } catch (error) {
      console.error(`❌ Failed to discover tools from ${config.name}:`, error);
    }
  }

  getAllTools(): ToolWithServer[] {
    return Array.from(this.tools.values());
  }

  getToolsByServer(serverId: string): ToolWithServer[] {
    return this.getAllTools().filter((tool) => tool.serverId === serverId);
  }

  async callTool(
    toolId: string,
    args: Record<string, unknown>,
    authContext?: {
      userId: string;
      oauthToken: string;
      scopes: string[];
    },
  ): Promise<unknown> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not found`);
    }

    const client = this.clients.get(tool.serverId);
    if (!client) {
      throw new Error(`MCP server ${tool.serverId} not connected`);
    }

    try {
      if (authContext) {
        this.authContexts.set(tool.serverId, {
          token: authContext.oauthToken,
          scopes: authContext.scopes,
        });
      }

      const result = await client.callTool({
        name: tool.name,
        arguments: args,
      });

      return result;
    } catch (error) {
      console.error(`❌ Tool call failed for ${toolId}:`, error);
      throw error;
    }
  }

  getAuthContext(serverId: string): { token: string; scopes: string[] } | undefined {
    return this.authContexts.get(serverId);
  }

  async disconnectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    const transport = this.transports.get(serverId);

    if (client) {
      await client.close();
      this.clients.delete(serverId);
    }

    if (transport) {
      this.transports.delete(serverId);
    }

    this.authContexts.delete(serverId);

    for (const [id, tool] of this.tools) {
      if (tool.serverId === serverId) {
        this.tools.delete(id);
      }
    }

    console.log(`🔌 Disconnected from ${serverId}`);
  }

  async disconnectAll(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      await this.disconnectServer(serverId);
    }
  }
}

export const mcpClientManager = new McpClientManager();
