#!/usr/bin/env bun
/**
 * Linear MCP Server
 *
 * This is a SEPARATE server that:
 * 1. Receives MCP tool calls from the backend
 * 2. Calls Linear GraphQL API using OAuth access tokens
 * 3. Returns structured JSON results
 *
 * IMPORTANT: This server does NOT store user data or tokens.
 * Tokens are passed per-request via the _oauthToken parameter.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Linear GraphQL API endpoint
const LINEAR_API_URL = "https://api.linear.app/graphql";

// Base schema with OAuth token and scopes (passed from backend)
const baseArgsSchema = z.object({
  _oauthToken: z.string(),
  _scopes: z.array(z.string()).optional(),
});

/**
 * Check if user has required scope for tool operation
 */
function checkScope(
  scopes: string[] | undefined,
  requiredScope: string
): void {
  if (!scopes) {
    throw new Error("Authorization required: No scopes provided");
  }

  // Check for exact scope or wildcard (e.g., "write" covers "write:issues")
  const hasScope = scopes.some(
    (scope) =>
      scope === requiredScope ||
      scope === "admin" ||
      (requiredScope.startsWith(scope + ":") && scope !== "read")
  );

  if (!hasScope) {
    throw new Error(
      `Insufficient permissions: '${requiredScope}' scope required. Available scopes: ${scopes.join(", ")}`
    );
  }
}

/**
 * Check if user has read access
 */
function checkReadScope(scopes: string[] | undefined): void {
  checkScope(scopes, "read");
}

/**
 * Check if user has write access
 */
function checkWriteScope(scopes: string[] | undefined): void {
  checkScope(scopes, "write");
}

// List issues schema
const listIssuesSchema = baseArgsSchema.extend({
  state: z.enum(["open", "closed", "all"]).optional(),
  limit: z.number().min(1).max(100).optional(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
});

// Get issue schema
const getIssueSchema = baseArgsSchema.extend({
  issueId: z.string(),
});

// Create issue schema
const createIssueSchema = baseArgsSchema.extend({
  title: z.string(),
  description: z.string().optional(),
  teamId: z.string(),
  assigneeId: z.string().optional(),
  projectId: z.string().optional(),
  priority: z.number().min(0).max(4).optional(),
  labels: z.array(z.string()).optional(),
});

// Update issue schema
const updateIssueSchema = baseArgsSchema.extend({
  issueId: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  state: z.enum(["open", "closed"]).optional(),
  priority: z.number().min(0).max(4).optional(),
  assigneeId: z.string().optional(),
});

// List teams schema
const listTeamsSchema = baseArgsSchema.extend({
  limit: z.number().min(1).max(100).optional(),
});

// List projects schema
const listProjectsSchema = baseArgsSchema.extend({
  limit: z.number().min(1).max(100).optional(),
  state: z.enum(["planned", "started", "paused", "completed", "canceled"]).optional(),
});

// Search issues schema
const searchIssuesSchema = baseArgsSchema.extend({
  query: z.string(),
  limit: z.number().min(1).max(50).optional(),
});

/**
 * Call Linear GraphQL API
 */
async function callLinearApi(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<any> {
  const response = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Linear API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(`Linear GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

// Create MCP Server
const server = new Server(
  { name: "linear-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "linear_list_issues",
        description: "List issues from Linear. Can filter by state, assignee, or project.",
        inputSchema: {
          type: "object",
          properties: {
            state: {
              type: "string",
              enum: ["open", "closed", "all"],
              description: "Filter by issue state",
            },
            limit: {
              type: "number",
              default: 50,
              description: "Maximum number of issues to return (1-100)",
            },
            assigneeId: {
              type: "string",
              description: "Filter by assignee user ID",
            },
            projectId: {
              type: "string",
              description: "Filter by project ID",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["_oauthToken"],
        },
      },
      {
        name: "linear_get_issue",
        description: "Get detailed information about a specific Linear issue by ID",
        inputSchema: {
          type: "object",
          properties: {
            issueId: {
              type: "string",
              description: "The unique identifier of the issue",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["issueId", "_oauthToken"],
        },
      },
      {
        name: "linear_create_issue",
        description: "Create a new issue in Linear (WRITE OPERATION)",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Issue title",
            },
            description: {
              type: "string",
              description: "Issue description (markdown supported)",
            },
            teamId: {
              type: "string",
              description: "ID of the team to create the issue in",
            },
            assigneeId: {
              type: "string",
              description: "ID of the user to assign the issue to",
            },
            projectId: {
              type: "string",
              description: "ID of the project to associate with",
            },
            priority: {
              type: "number",
              minimum: 0,
              maximum: 4,
              description: "Priority level (0=no priority, 1=urgent, 4=low)",
            },
            labels: {
              type: "array",
              items: { type: "string" },
              description: "Label IDs to apply to the issue",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["title", "teamId", "_oauthToken"],
        },
      },
      {
        name: "linear_update_issue",
        description: "Update an existing Linear issue (WRITE OPERATION)",
        inputSchema: {
          type: "object",
          properties: {
            issueId: {
              type: "string",
              description: "ID of the issue to update",
            },
            title: {
              type: "string",
              description: "New title for the issue",
            },
            description: {
              type: "string",
              description: "New description for the issue",
            },
            state: {
              type: "string",
              enum: ["open", "closed"],
              description: "Change the issue state",
            },
            priority: {
              type: "number",
              minimum: 0,
              maximum: 4,
              description: "Update priority level",
            },
            assigneeId: {
              type: "string",
              description: "Change the assignee",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["issueId", "_oauthToken"],
        },
      },
      {
        name: "linear_list_teams",
        description: "List all teams in the Linear workspace",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              default: 50,
              description: "Maximum number of teams to return",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["_oauthToken"],
        },
      },
      {
        name: "linear_list_projects",
        description: "List all projects in the Linear workspace",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              default: 50,
              description: "Maximum number of projects to return",
            },
            state: {
              type: "string",
              enum: ["planned", "started", "paused", "completed", "canceled"],
              description: "Filter by project state",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["_oauthToken"],
        },
      },
      {
        name: "linear_search_issues",
        description: "Search for issues by title, description, or identifier",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query string",
            },
            limit: {
              type: "number",
              default: 20,
              description: "Maximum number of results",
            },
            _oauthToken: {
              type: "string",
              description: "OAuth access token (provided by backend)",
            },
          },
          required: ["query", "_oauthToken"],
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
      case "linear_list_issues": {
        // Verify read permission
        checkReadScope(parsedArgs._scopes as string[] | undefined);
        
        const { state, limit = 50, assigneeId, projectId } =
          listIssuesSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        // Build filter
        const filter: any = {};
        if (state && state !== "all") {
          filter.state = state === "open" ? { type: { eq: "unstarted" } } : { type: { eq: "completed" } };
        }
        if (assigneeId) {
          filter.assignee = { id: { eq: assigneeId } };
        }
        if (projectId) {
          filter.project = { id: { eq: projectId } };
        }

        const query = `
          query GetIssues($filter: IssueFilter, $first: Int) {
            issues(filter: $filter, first: $first) {
              nodes {
                id
                identifier
                title
                description
                state {
                  name
                  type
                  color
                }
                assignee {
                  id
                  name
                  email
                }
                project {
                  id
                  name
                }
                priority
                createdAt
                updatedAt
                url
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `;

        const data = await callLinearApi(token, query, {
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          first: limit,
        });

        result = {
          issues: data.issues.nodes.map((issue: any) => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            state: issue.state?.name,
            stateType: issue.state?.type,
            priority: issue.priority,
            assignee: issue.assignee?.name,
            assigneeEmail: issue.assignee?.email,
            project: issue.project?.name,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            url: issue.url,
          })),
          totalCount: data.issues.nodes.length,
          hasMore: data.issues.pageInfo.hasNextPage,
        };
        break;
      }

      case "linear_get_issue": {
        // Verify read permission
        checkReadScope(parsedArgs._scopes as string[] | undefined);

        const { issueId } = getIssueSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        const query = `
          query GetIssue($id: String!) {
            issue(id: $id) {
              id
              identifier
              title
              description
              state {
                name
                type
                color
              }
              assignee {
                id
                name
                email
              }
              project {
                id
                name
              }
              team {
                id
                name
              }
              priority
              labels {
                nodes {
                  name
                  color
                }
              }
              comments {
                nodes {
                  id
                  body
                  user {
                    name
                  }
                  createdAt
                }
              }
              createdAt
              updatedAt
              url
            }
          }
        `;

        const data = await callLinearApi(token, query, { id: issueId });

        result = {
          id: data.issue.id,
          identifier: data.issue.identifier,
          title: data.issue.title,
          description: data.issue.description,
          state: data.issue.state?.name,
          stateType: data.issue.state?.type,
          priority: data.issue.priority,
          assignee: data.issue.assignee?.name,
          assigneeEmail: data.issue.assignee?.email,
          project: data.issue.project?.name,
          team: data.issue.team?.name,
          labels: data.issue.labels?.nodes.map((l: any) => l.name),
          comments: data.issue.comments?.nodes.map((c: any) => ({
            id: c.id,
            body: c.body,
            author: c.user?.name,
            createdAt: c.createdAt,
          })),
          createdAt: data.issue.createdAt,
          updatedAt: data.issue.updatedAt,
          url: data.issue.url,
        };
        break;
      }

      case "linear_create_issue": {
        // Verify write permission
        checkWriteScope(parsedArgs._scopes as string[] | undefined);
        
        const {
          title,
          description,
          teamId,
          assigneeId,
          projectId,
          priority,
          labels,
        } = createIssueSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        const query = `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
                state {
                  name
                }
              }
            }
          }
        `;

        const input: any = {
          title,
          teamId,
        };
        if (description) input.description = description;
        if (assigneeId) input.assigneeId = assigneeId;
        if (projectId) input.projectId = projectId;
        if (priority !== undefined) input.priority = priority;
        if (labels && labels.length > 0) input.labelIds = labels;

        const data = await callLinearApi(token, query, { input });

        if (!data.issueCreate.success) {
          throw new Error("Failed to create issue");
        }

        result = {
          success: true,
          issue: {
            id: data.issueCreate.issue.id,
            identifier: data.issueCreate.issue.identifier,
            title: data.issueCreate.issue.title,
            state: data.issueCreate.issue.state?.name,
            url: data.issueCreate.issue.url,
          },
        };
        break;
      }

      case "linear_update_issue": {
        // Verify write permission
        checkWriteScope(parsedArgs._scopes as string[] | undefined);

        const { issueId, title, description, state, priority, assigneeId } =
          updateIssueSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        const query = `
          mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
                identifier
                title
                state {
                  name
                }
                url
              }
            }
          }
        `;

        const input: any = {};
        if (title) input.title = title;
        if (description) input.description = description;
        if (priority !== undefined) input.priority = priority;
        if (assigneeId) input.assigneeId = assigneeId;
        if (state) {
          // Map state to Linear state IDs - this requires fetching available states
          // For simplicity, we'll handle basic open/closed
          input.stateId = state; // This would need proper state ID resolution
        }

        const data = await callLinearApi(token, query, { id: issueId, input });

        if (!data.issueUpdate.success) {
          throw new Error("Failed to update issue");
        }

        result = {
          success: true,
          issue: {
            id: data.issueUpdate.issue.id,
            identifier: data.issueUpdate.issue.identifier,
            title: data.issueUpdate.issue.title,
            state: data.issueUpdate.issue.state?.name,
            url: data.issueUpdate.issue.url,
          },
        };
        break;
      }

      case "linear_list_teams": {
        // Verify read permission
        checkReadScope(parsedArgs._scopes as string[] | undefined);

        const { limit = 50 } = listTeamsSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        const query = `
          query GetTeams($first: Int) {
            teams(first: $first) {
              nodes {
                id
                name
                key
                description
                color
                icon
                private
                autoArchivePeriod
                createdAt
              }
            }
          }
        `;

        const data = await callLinearApi(token, query, { first: limit });

        result = {
          teams: data.teams.nodes.map((team: any) => ({
            id: team.id,
            name: team.name,
            key: team.key,
            description: team.description,
            color: team.color,
            icon: team.icon,
            isPrivate: team.private,
            autoArchivePeriod: team.autoArchivePeriod,
            createdAt: team.createdAt,
          })),
          totalCount: data.teams.nodes.length,
        };
        break;
      }

      case "linear_list_projects": {
        // Verify read permission
        checkReadScope(parsedArgs._scopes as string[] | undefined);

        const { limit = 50, state } = listProjectsSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        const query = `
          query GetProjects($first: Int, $filter: ProjectFilter) {
            projects(first: $first, filter: $filter) {
              nodes {
                id
                name
                description
                state
                color
                icon
                startDate
                targetDate
                progress
                lead {
                  name
                  email
                }
                createdAt
                updatedAt
                url
              }
            }
          }
        `;

        const filter = state ? { state: { eq: state } } : undefined;
        const data = await callLinearApi(token, query, { first: limit, filter });

        result = {
          projects: data.projects.nodes.map((project: any) => ({
            id: project.id,
            name: project.name,
            description: project.description,
            state: project.state,
            color: project.color,
            icon: project.icon,
            startDate: project.startDate,
            targetDate: project.targetDate,
            progress: project.progress,
            lead: project.lead?.name,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            url: project.url,
          })),
          totalCount: data.projects.nodes.length,
        };
        break;
      }

      case "linear_search_issues": {
        // Verify read permission
        checkReadScope(parsedArgs._scopes as string[] | undefined);

        const { query: searchQuery, limit = 20 } = searchIssuesSchema.parse(parsedArgs);
        const token = parsedArgs._oauthToken as string;

        const query = `
          query SearchIssues($term: String!, $first: Int) {
            issueSearch(term: $term, first: $first) {
              nodes {
                id
                identifier
                title
                description
                state {
                  name
                  type
                }
                assignee {
                  name
                  email
                }
                priority
                createdAt
                url
              }
            }
          }
        `;

        const data = await callLinearApi(token, query, {
          term: searchQuery,
          first: limit,
        });

        result = {
          issues: data.issueSearch.nodes.map((issue: any) => ({
            id: issue.id,
            identifier: issue.identifier,
            title: issue.title,
            description: issue.description,
            state: issue.state?.name,
            stateType: issue.state?.type,
            priority: issue.priority,
            assignee: issue.assignee?.name,
            createdAt: issue.createdAt,
            url: issue.url,
          })),
          totalCount: data.issueSearch.nodes.length,
        };
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
  console.error("Linear MCP Server running on stdio");
}

main().catch(console.error);
