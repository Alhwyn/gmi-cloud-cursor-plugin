# GMI Cloud for Cursor

An unofficial, MIT-licensed Cursor plugin for [GMI Cloud](https://www.gmicloud.ai): server-side LLM integration guidance and a local TypeScript stdio MCP server. No affiliation or endorsement implied. This repository is local-only; it has not been published to a marketplace.

## Install locally

Requires only Node.js 20+ at runtime. The committed `bundle/server.mjs` includes the server and its dependencies, so installation requires no dependency install or build steps. MCP deliberately continues to launch with `node` for end-user compatibility; Bun is only required for development and the optional live integration script.

```sh
cd /home/ubuntu/repos/gmi-cloud-cursor-plugin
mkdir -p ~/.cursor/plugins/local
ln -s /home/ubuntu/repos/gmi-cloud-cursor-plugin ~/.cursor/plugins/local/gmi-cloud
```

If that destination already exists, use it or choose a different unused name rather than overwriting it. Set your GMI API key in the environment from which Cursor is launched (the docs call the same credential `GMI_API_KEY`; this plugin consistently uses `GMI_CLOUD_API_KEY`):

```sh
read -rsp 'GMI API key: ' GMI_CLOUD_API_KEY; echo
export GMI_CLOUD_API_KEY
cursor .
```

Completely quit any existing Cursor process first so the newly launched process inherits the key. On platforms where the GUI does not inherit shell variables, supply `GMI_CLOUD_API_KEY` through Cursor's MCP environment configuration; never commit its literal value. The plugin's `mcp.json` uses Cursor's `${env:GMI_CLOUD_API_KEY}` interpolation. Restart Cursor, check that the local plugin and `gmi-cloud` MCP server are enabled, and approve tools as appropriate. Never paste keys into chat. To uninstall, disable the plugin and remove only the local symlink.

The single-plugin layout follows the [official template](https://github.com/cursor/plugin-template) and [plugin reference](https://cursor.com/docs/reference/plugins): `.cursor-plugin/plugin.json`, auto-discovered `rules/`, `skills/`, and `mcp.json`. MCP starts `node ${CURSOR_PLUGIN_ROOT}/bundle/server.mjs`; the install path is resolved by Cursor, not hardcoded. No marketplace manifest, commands, agents, or hooks are required or included. For future marketplace installation, use Cursor's Customize → plugin installation flow once the repository is published; no GitHub URL or marketplace listing exists yet.

## Included

| Tool | Behavior |
| --- | --- |
| `gmi_list_models` | List LLM models |
| `gmi_chat_completion` | Non-streaming text chat (`model`, nonempty `messages`, optional `max_tokens`, `temperature`) |
| `gmi_list_media_models` | List request-queue models |
| `gmi_get_media_model` | Retrieve a media model's parameter schema |
| `gmi_submit_media` | Submit `{model, payload}`; return request ID/status |
| `gmi_check_media` | Retrieve one request's status and outcome artifact links |

The two skills cover integrating inference and picking LLM/media models. The on-request `.mdc` rule describes secure GMI coding patterns and OpenAI SDK configuration. Invoke the skills or ask Cursor to use the GMI rule when relevant.

Chat and media generation can incur charges. Confirm intent before invoking them. The MCP server does not enforce a billing approval dialog: use Cursor's tool approval controls. Media parameters are model-specific; discover the schema before submitting. Submission is asynchronous; check using the returned request ID. Tools return upstream JSON, do not poll, do not download artifacts, and never retry automatically. Each fetch has a 120-second timeout. A timed-out POST may still have created a billable job. HTTP error bodies are deliberately omitted from tool errors to avoid leaking sensitive upstream content. No keys are required for starting the server or listing tools; actual API tools fail clearly without a key.

The chat tool intentionally exposes a text-only subset, not streaming, audio, images, function calling, or every OpenAI parameter. Model-specific parameter support varies. This plugin does not provision GPU instances or use undocumented GPU APIs.

## Confirmed API surface

All requests use `Authorization: Bearer <GMI_CLOUD_API_KEY>`; POST bodies use `Content-Type: application/json`.

| Method | Endpoint | Documentation |
| --- | --- | --- |
| GET | `https://api.gmi-serving.com/v1/models` | [LLM API reference](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference) |
| POST | `https://api.gmi-serving.com/v1/chat/completions` | [LLM API reference](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference), [OpenAI-compatible quickstart](https://docs.gmicloud.ai/quickstart) |
| GET | `https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/models` | [Video / queue API reference](https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference) |
| GET | `https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/models/{model-id}` | [Video / queue API reference](https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference) |
| POST | `https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests` | [Video / queue API reference](https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference), [image generation example](https://docs.gmicloud.ai/model-quickstarts/image/reve-create-20250915) |
| GET | `https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests/{request_id}` | [Video / queue API reference](https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference), [image generation example](https://docs.gmicloud.ai/model-quickstarts/image/reve-create-20250915) |

OpenAI SDK base URL: `https://api.gmi-serving.com/v1`. Queue IDs are URL-encoded. Model availability and pricing should be checked against current docs/account access, not hardcoded assumptions. References were researched while creating this plugin; no live authenticated API requests were made.

## Development and verification

```sh
bun install --frozen-lockfile
bun run build
bun test
bun run check:bundle
bun run smoke
```

Use Bun 1.4.5 (the version pinned in `packageManager`) for reproducible output; on this machine it is `/home/ubuntu/.bun/bin/bun`. `bun.lock` is the dependency lockfile. `bun run build` type-checks the server, then invokes `bun build` targeting Node ESM with bundled packages and environment inlining disabled. No esbuild or npm tooling is used.

Tests run with `bun test` and mocked fetch through MCP's in-memory transport: routing, auth, JSON bodies, response passthrough, empty model lists, completed outcomes, invalid input, missing credentials, 401/429/500, network failure, and invalid/empty JSON. The suite also tests the live workflow using fake tool calls and runs the bundle freshness check. `bun run check:bundle` regenerates the bundle in memory and compares bytes against the committed file; it fails if missing or stale. After source/dependency changes run `bun run build` and commit `bundle/server.mjs` along with the source and lockfile. CI should run `bun install --frozen-lockfile && bun test` without rebuilding first, so stale committed artifacts cannot be hidden.

The dependency-free smoke script runs under Bun and launches the committed bundle with `node`, exactly as `mcp.json` does. It initializes MCP and asserts all six names from `tools/list`. Run `bun scripts/smoke.mjs` in a fresh clone without `node_modules` to verify installability. No credentials or network are needed. The bundle needs only Node built-ins at runtime. `dist/` and `node_modules/` remain ignored; `bundle/` is tracked.

## Optional paid live integration

**Not part of the test suite; running with a key spends credits.** After `bun install --frozen-lockfile`, explicitly run:

```sh
bun scripts/live.ts
```

If `GMI_CLOUD_API_KEY` is unset, the script prints a SKIP message and exits successfully without starting MCP or making requests. With a key it connects to the committed bundle over stdio using the MCP SDK (all API operations go through MCP), lists LLM/media IDs, verifies the selected media IDs exist, and fetches their schemas before making paid calls. It requests one short chat completion (16-token cap), one image, and one 4-second video. Model choice is deliberately limited to documented payloads rather than guessing parameters for arbitrary models:

- Image: `flux-kontext-pro`, one square ~1MP image, no prompt upsampling. Its [model docs](https://docs.gmicloud.ai/model-quickstarts/image/flux-kontext-pro) list $0.05/image: a low-cost smoke target, not a claim that it is the cheapest model. Check current account pricing before running.
- Video: `Veo3-Fast`, 4 seconds, 16:9, no people. The [model docs](https://docs.gmicloud.ai/model-quickstarts/video/veo3-fast) explicitly allow 4-second requests. Video is billable separately.
- Chat: prefer `meta-llama/Llama-3.3-70B-Instruct` if available, otherwise the first listed model. Parameter support can differ; there are no automatic paid retries if it fails.

For each media request it prints model ID, request ID, final status, and output URLs. It polls every 10 seconds for up to 10 minutes per job, handling `success`, `failed`, and `cancelled`; unknown statuses and tool errors fail clearly. A failed image job does not prevent attempting the video. Missing/empty discovery results stop before paid requests. Timeouts do not cancel upstream jobs, which may still complete and charge; preserve the printed request ID for manual status checks. No artifacts are downloaded or POSTs retried. A failed job, missing chat choices, tool error, or timeout produces a nonzero exit status. URLs may be signed/private: treat the console output as sensitive.

Cursor UI discovery and real paid inference require separate manual verification; these automated checks do not establish either. The live script has not been run against GMI Cloud.
