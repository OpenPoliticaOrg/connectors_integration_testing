#!/usr/bin/env bun
/**
 * GitHub MCP Server
 *
 * This is a SEPARATE server that:
 * 1. Receives MCP tool calls from the backend
 * 2. Generates SHORT-LIVED installation tokens (1 hour max)
 * 3. Calls GitHub API
 * 4. Returns structured JSON results
 *
 * IMPORTANT: This server does NOT store user data.
 * It only knows about GitHub App credentials.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { sign } from "jsonwebtoken";

// GitHub App credentials (from environment)
const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!;

// Cache for installation tokens
type TokenCache = {
  token: string;
  expiresAt: number;
};

const tokenCache = new Map<number, TokenCache>();

const baseArgsSchema = z.object({
  _installationId: z.number(),
});

const listReposSchema = baseArgsSchema.extend({
  visibility: z.enum(["all", "public", "private"]).optional(),
  sort: z.enum(["created", "updated", "pushed", "full_name"]).optional(),
  per_page: z.number().min(1).max(100).optional(),
});

const getRepoSchema = baseArgsSchema.extend({
  owner: z.string(),
  repo: z.string(),
});

const listIssuesSchema = baseArgsSchema.extend({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).optional(),
  per_page: z.number().min(1).max(100).optional(),
});

const createIssueSchema = baseArgsSchema.extend({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

/**
 * Generate JWT for GitHub App
 * Used to authenticate with GitHub API as the app itself
 */
function generateAppJWT(): string {
  const now = Math.floor(Date.now() / 1000);

  return sign(
    {
      iat: now,
      exp: now + 600, // 10 minutes max
      iss: GITHUB_APP_ID,
    },
    GITHUB_APP_PRIVATE_KEY,
    { algorithm: "RS256" },
  );
}

/**
 * Generate short-lived installation token
 * Creates a new token or returns cached one if still valid
 */
async function getInstallationToken(installationId: number): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(installationId);
  if (cached && cached.expiresAt > Date.now() + 300000) {
    // 5 min buffer
    return cached.token;
  }

  // Generate new token
  const appJWT = generateAppJWT();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appJWT}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to generate installation token: ${response.statusText}`,
    );
  }

  const data: any = await response.json();
  const token = data.token;
  const expiresAt = new Date(data.expires_at).getTime();

  // Cache it
  tokenCache.set(installationId, { token, expiresAt });

  return token;
}

/**
 * Call GitHub API with installation token
 */
async function callGitHubApi(
  endpoint: string,
  installationId: number,
  options: RequestInit = {},
): Promise<any> {
  const token = await getInstallationToken(installationId);

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ai-agent-github-mcp",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Create MCP Server
const server = new Server(
  { name: "github-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "github_list_repositories",
        description: "List repositories accessible to the installation",
        inputSchema: {
          type: "object",
          properties: {
            visibility: {
              type: "string",
              enum: ["all", "public", "private"],
            },
            sort: {
              type: "string",
              enum: ["created", "updated", "pushed", "full_name"],
            },
            per_page: { type: "number", default: 30 },
            _installationId: { type: "number" },
          },
          required: ["_installationId"],
        },
      },
      {
        name: "github_get_repository",
        description: "Get repository details",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            _installationId: { type: "number" },
          },
          required: ["owner", "repo", "_installationId"],
        },
      },
      {
        name: "github_list_issues",
        description: "List issues in a repository",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            state: { type: "string", enum: ["open", "closed", "all"] },
            per_page: { type: "number", default: 30 },
            _installationId: { type: "number" },
          },
          required: ["owner", "repo", "_installationId"],
        },
      },
      {
        name: "github_create_issue",
        description: "Create a new issue (WRITE OPERATION)",
        inputSchema: {
          type: "object",
          properties: {
            owner: { type: "string" },
            repo: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            labels: { type: "array", items: { type: "string" } },
            _installationId: { type: "number" },
          },
          required: ["owner", "repo", "title", "_installationId"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args || typeof args !== "object") {
    throw new Error("Invalid arguments");
  }

  const parsedArgs = args as Record<string, unknown>;

  try {
    let result: any;

    switch (name) {
      case "github_list_repositories": {
        const { visibility, sort, per_page } =
          listReposSchema.parse(parsedArgs);
        const params = new URLSearchParams();
        if (visibility) params.append("visibility", visibility);
        if (sort) params.append("sort", sort);
        if (per_page) params.append("per_page", per_page.toString());

        result = await callGitHubApi(
          `/user/repos?${params.toString()}`,
          parsedArgs._installationId as number,
        );

        result = result.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          description: repo.description,
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language,
        }));
        break;
      }

      case "github_get_repository": {
        const { owner, repo } = getRepoSchema.parse(parsedArgs);
        result = await callGitHubApi(
          `/repos/${owner}/${repo}`,
          parsedArgs._installationId as number,
        );
        break;
      }

      case "github_list_issues": {
        const { owner, repo, state, per_page } =
          listIssuesSchema.parse(parsedArgs);
        const params = new URLSearchParams();
        if (state) params.append("state", state);
        if (per_page) params.append("per_page", per_page.toString());

        result = await callGitHubApi(
          `/repos/${owner}/${repo}/issues?${params.toString()}`,
          parsedArgs._installationId as number,
        );

        result = result.map((issue: any) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          createdAt: issue.created_at,
          author: issue.user?.login,
        }));
        break;
      }

      case "github_create_issue": {
        const { owner, repo, title, body, labels } =
          createIssueSchema.parse(parsedArgs);
        result = await callGitHubApi(
          `/repos/${owner}/${repo}/issues`,
          parsedArgs._installationId as number,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, body, labels }),
          },
        );
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    throw new Error(`Tool ${name} failed: ${(error as Error).message}`);
  }
});

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP Server running on stdio");
}

main().catch(console.error);
