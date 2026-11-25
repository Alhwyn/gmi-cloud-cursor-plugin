import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runLive, type Tool } from './live-flow.ts';

const key = process.env.GMI_CLOUD_API_KEY;
if (!key?.trim()) {
  console.log('SKIP: GMI_CLOUD_API_KEY is unset; no live requests made.');
} else {
  console.log('LIVE: paid chat + one image + one 4-second video; submissions are not retried.');
  const transport = new StdioClientTransport({
    command: 'node', args: [fileURLToPath(new URL('../bundle/server.mjs', import.meta.url))],
    env: { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), GMI_CLOUD_API_KEY: key },
    stderr: 'inherit',
  });
  const client = new Client({ name: 'gmi-live', version: '1.0.0' });
  const log = (message: string) => console.log(message.replaceAll(key, '[REDACTED]'));
  const tool: Tool = async (name, args, timeoutMs = 125_000) => {
    const response = await client.callTool({ name, arguments: args }, undefined, { timeout: timeoutMs });
    const text = Array.isArray(response.content) ? response.content.find((item) => item.type === 'text')?.text : undefined;
    if (response.isError) throw new Error(typeof text === 'string' ? text : `Tool ${name} failed`);
    if (typeof text !== 'string') throw new Error(`Tool ${name} returned no JSON text`);
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Tool ${name} returned invalid JSON shape`);
    return parsed as Record<string, unknown>;
  };
  try {
    await client.connect(transport);
    await runLive(tool, log);
  } catch (error) {
    log(error instanceof Error ? error.message : 'Live integration failed');
    process.exitCode = 1;
  } finally { await client.close(); await transport.close(); }
}
