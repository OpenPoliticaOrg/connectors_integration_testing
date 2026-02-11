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

  /**
   * Connect to an MCP server via HTTP/SSE
   */
  async connectServer(config: McpServerConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      console.log(`Already connected to ${config.name}`);
      return;
    }

    try {
      // Create SSE transport
      const transport = new SSEClientTransport(new URL(config.url));

      // Add auth header if provided
      if (config.authToken) {
        transport.onmessage = (message) => {
          // Handle incoming messages
          console.log(`[${config.name}] Message:`, message);
        };
      }

      // Create client
      const client = new Client(
        {
          name: "ai-agent-backend",
          version: "1.0.0",
        },
        {
          capabilities: {},
        },
      );

      // Connect
      await client.connect(transport);

      // Store references
      this.clients.set(config.id, client);
      this.transports.set(config.id, transport);

      // Discover tools
      await this.discoverTools(config);

      console.log(`✅ Connected to ${config.name} MCP server`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Discover tools from an MCP server
   */
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

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): ToolWithServer[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools filtered by server
   */
  getToolsByServer(serverId: string): ToolWithServer[] {
    return this.getAllTools().filter((tool) => tool.serverId === serverId);
  }

  /**
   * Call a tool on an MCP server
   */
  async callTool(
    toolId: string,
    args: Record<string, unknown>,
    userContext?: {
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
      // Add user context to arguments
      const enrichedArgs = {
        ...args,
        _userId: userContext?.userId,
        _oauthToken: userContext?.oauthToken,
        _scopes: userContext?.scopes,
      };

      const result = await client.callTool({
        name: tool.name,
        arguments: enrichedArgs,
      });

      return result;
    } catch (error) {
      console.error(`❌ Tool call failed for ${toolId}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from an MCP server
   */
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

    // Remove tools from this server
    for (const [id, tool] of this.tools) {
      if (tool.serverId === serverId) {
        this.tools.delete(id);
      }
    }

    console.log(`🔌 Disconnected from ${serverId}`);
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    for (const serverId of this.clients.keys()) {
      await this.disconnectServer(serverId);
    }
  }
}

// Export singleton instance
export const mcpClientManager = new McpClientManager();
