import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const child = spawn(process.execPath, [fileURLToPath(new URL('../bundle/server.mjs', import.meta.url))], {
  stdio: ['pipe', 'pipe', 'inherit'], env: { ...process.env, GMI_CLOUD_API_KEY: '' },
});
const pending = new Map();
const fail = (error) => { for (const waiter of pending.values()) waiter.reject(error); };
child.on('error', fail);
child.on('exit', (code) => fail(new Error(`Server exited ${code}`)));
const lines = createInterface({ input: child.stdout });
lines.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    }
  } catch (error) { fail(error); }
});
const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
const request = (id, method, params) => new Promise((resolve, reject) => {
  pending.set(id, { resolve, reject });
  send({ id, method, params });
});
const timeout = setTimeout(() => { fail(new Error('Smoke test timed out')); child.kill(); }, 15_000);
try {
  const initialized = await request(1, 'initialize', {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'gmi-smoke', version: '1.0.0' },
  });
  assert.ok(initialized.capabilities.tools);
  send({ method: 'notifications/initialized' });
  const { tools } = await request(2, 'tools/list', {});
  const names = tools.map(({ name }) => name).sort();
  assert.deepEqual(names, ['gmi_chat_completion', 'gmi_check_media', 'gmi_get_media_model', 'gmi_list_media_models', 'gmi_list_models', 'gmi_submit_media']);
  console.log('tools/list:', JSON.stringify(names));
  console.log('PASS: bundled stdio initialization and tools/list (6 tools; no node_modules, API key, or network needed)');
} finally { clearTimeout(timeout); lines.close(); child.stdin.end(); child.kill(); }
