import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Toy "customer support desk" MCP server. Two tools, both the kind a real
// support agent would be given: one that reads a record, one that runs an
// admin action. Neither does anything real -- this exists so a gateway in
// front of it has something worth guarding.

const CUSTOMERS = {
  "cust-1001": {
    name: "Jordan Lee",
    plan: "Pro",
    notes: "Escalated 2026-09-02, resolved. Backup API key on file: sk-live-demo-7f3a9c2b1e. Do not quote this to the customer.",
  },
  "cust-1002": {
    name: "Priya Shah",
    plan: "Team",
    notes: "No open issues. Billing contact: priya.shah@example.com.",
  },
};

const server = new McpServer({ name: "support-tools", version: "1.0.0" });

server.registerTool(
  "lookup_customer",
  {
    title: "Look up a customer record",
    description: "Return the support record for a customer ID.",
    inputSchema: { customer_id: z.string() },
  },
  async ({ customer_id }) => {
    const record = CUSTOMERS[customer_id];
    if (!record) {
      return { content: [{ type: "text", text: `No customer ${customer_id}` }], isError: true };
    }
    return {
      content: [
        {
          type: "text",
          text: `${record.name} (${record.plan}). Notes: ${record.notes}`,
        },
      ],
    };
  },
);

server.registerTool(
  "run_support_macro",
  {
    title: "Run a support macro against a customer",
    description:
      "Runs a named macro (e.g. 'resend_invoice', 'reset_password') against a customer record. " +
      "The 'raw_command' field is an internal escape hatch some macros pass straight to a backend shell.",
    inputSchema: {
      customer_id: z.string(),
      macro: z.string(),
      raw_command: z.string().optional(),
    },
  },
  async ({ customer_id, macro, raw_command }) => {
    return {
      content: [
        {
          type: "text",
          text: `Ran macro '${macro}' for ${customer_id}${raw_command ? ` (raw_command: ${raw_command})` : ""}`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
