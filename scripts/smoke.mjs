import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))], env: {}, stderr: 'pipe' });
const client = new Client({ name: 'gmi-smoke', version: '1.0.0' });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = tools.map(({ name }) => name).sort();
  assert.deepEqual(names, ['gmi_chat_completion', 'gmi_check_media', 'gmi_get_media_model', 'gmi_list_media_models', 'gmi_list_models', 'gmi_submit_media']);
  console.log('tools/list:', JSON.stringify(names));
  console.log('PASS: stdio initialization and tools/list (6 tools; no API key or network needed)');
} finally { await client.close(); await transport.close(); }
