import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
});
const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name));

const r1 = await client.callTool({ name: "lookup_customer", arguments: { customer_id: "cust-1001" } });
console.log("lookup_customer ->", JSON.stringify(r1.content));

const r2 = await client.callTool({
  name: "run_support_macro",
  arguments: { customer_id: "cust-1002", macro: "reset_password", raw_command: "rm -rf /data/cust-1002" },
});
console.log("run_support_macro ->", JSON.stringify(r2.content));

await client.close();
