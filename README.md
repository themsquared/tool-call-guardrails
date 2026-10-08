# tool-call-guardrails

Guardrails on MCP tool calls, enforced at the gateway, before the tool ever executes.
Not a prompt filter: the policy sees the actual `tools/call` request and response,
in-process, with no external service to stand up.

## The problem

Most "LLM guardrail" products scan the chat messages going into and out of a model.
That catches a prompt injection typed by a user. It does not catch anything that
happens one layer down, inside a tool call an agent makes on its own: the arguments
an agent passes to a tool, and the raw data a tool hands back before anything
summarizes it for the model.

[agentgateway](https://agentgateway.dev)'s MCP guardrails run at that layer. A
processor sees the resolved `tools/call` method, the tool name, and the arguments
(or, on the way back, the result), and can reject, or rewrite, the call before it
reaches the upstream MCP server, and the result before it reaches the client.

## What this demo shows

A toy "support desk" MCP server with two tools: `lookup_customer` (reads a record)
and `run_support_macro` (runs a named action, with a `raw_command` escape hatch some
macros use). Three guardrail processors, run in order, in front of it:

1. **Reject before execution.** A `run_support_macro` call whose `raw_command`
   contains `rm -rf` is refused. The tool is never invoked.
2. **Mask on the way in.** An email address typed into a macro argument is replaced
   with `[EMAIL]` before the argument reaches the tool, so it is never written to
   whatever system the macro touches.
3. **Mask on the way out.** An API key the toy server (realistically, carelessly)
   returns in a customer's notes field is replaced with `[REDACTED_KEY]` before the
   result reaches the client.

All three are plain CEL expressions in one YAML file. No sidecar service, no gRPC
server to write and run.

## Prerequisites

- An `agentgateway` build containing the CEL MCP guardrails processor
  (`mcpGuardrails.processors[].kind: expression`). This shipped to `main` on
  2026-10-06 ([commit `276f10d`](https://github.com/agentgateway/agentgateway/commit/276f10dc68430762674d6d64f3baecead963ac78))
  and is **not in a tagged release yet** as of this writing (the last release,
  [v1.6.0](https://github.com/agentgateway/agentgateway/releases/tag/v1.6.0), predates it).
  Build from source:

  ```bash
  git clone https://github.com/agentgateway/agentgateway.git
  cd agentgateway
  cargo build --release
  # binary at target/release/agentgateway
  ```
- Node.js 18+ (for the demo MCP server and the MCP Inspector CLI).

## Run it

```bash
npm install --prefix mcp-server
AGENTGATEWAY_BIN=/path/to/agentgateway/target/release/agentgateway ./scripts/demo.sh
```

This starts `agentgateway -f config.yaml` (which spawns `mcp-server/server.js` as
its MCP target over stdio), then drives three `tools/call` requests at it through
[`@modelcontextprotocol/inspector --cli`](https://github.com/modelcontextprotocol/inspector),
non-interactively, and saves each response under `captures/`.

## The policy

```yaml
mcp:
  policies:
    mcpGuardrails:
      processors:
      - kind: expression
        methods: {"tools/call": request}
        condition: >-
          mcp.params.name == 'run_support_macro' &&
          has(mcp.params.arguments) &&
          has(mcp.params.arguments.raw_command) &&
          mcp.params.arguments.raw_command.contains('rm -rf')
        reject: "raw_command contains a destructive shell pattern; this macro requires human review"
      # ... mask processors, see config.yaml
```

`mcp.params` is the request's MCP `params` object; `mcp.result` is the response's
MCP `result` object. A `reject` short-circuits the chain and the tool is never
called. A `transform` returns a replacement body that later processors (and
ultimately the upstream server or the client) see instead of the original.

## Write-up

> 📖 **Read the write-up:** (added once the post is live)

## License

Apache-2.0. All data in this repo is invented; nothing here represents a real
customer, ticket, or credential.

## Topics

`agentgateway` `mcp` `ai-agents` `kubernetes` `llm-security`
