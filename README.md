# GMI Cloud for Cursor

An unofficial, MIT-licensed Cursor plugin for [GMI Cloud](https://www.gmicloud.ai): server-side LLM integration guidance and a local TypeScript stdio MCP server. No affiliation or endorsement implied. This repository is local-only; it has not been published to a marketplace.

## Install locally

Requires Node.js 20+ and npm. Build **before** enabling the plugin; Cursor does not install dependencies or compile TypeScript for you.

```sh
cd /home/ubuntu/repos/gmi-cloud-cursor-plugin
npm ci
npm run build
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

The single-plugin layout follows the [official template](https://github.com/cursor/plugin-template) and [plugin reference](https://cursor.com/docs/reference/plugins): `.cursor-plugin/plugin.json`, auto-discovered `rules/`, `skills/`, and `mcp.json`. MCP starts `node ${CURSOR_PLUGIN_ROOT}/dist/index.js`; the install path is resolved by Cursor, not hardcoded. No marketplace manifest, commands, agents, or hooks are required or included. For future marketplace installation, use Cursor's Customize → plugin installation flow once the repository is published; no GitHub URL or marketplace listing exists yet.

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
npm ci
npm run build
npm test
npm run smoke
```

Tests use mocked fetch through MCP's in-memory transport: routing, auth, JSON bodies, response passthrough, empty model lists, completed outcomes, invalid input, missing credentials, 401/429/500, network failure, and invalid/empty JSON. The smoke test launches the compiled server as a real stdio subprocess, initializes MCP, and asserts all six names from `tools/list` without credentials or network. Build output and dependencies are ignored by git; rebuild in any new install location.

Cursor UI discovery and real paid inference require separate manual verification; these automated checks do not establish either.
