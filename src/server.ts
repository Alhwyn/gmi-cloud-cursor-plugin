import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GmiClient } from './client.js';

export function createServer(client = new GmiClient()) {
  const server = new McpServer({ name: 'gmi-cloud', version: '0.1.0' });
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
  const write = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
  const run = async (action: () => Promise<unknown>) => {
    try { return { content: [{ type: 'text' as const, text: JSON.stringify(await action()) }] }; }
    catch (error) { return { isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'GMI Cloud request failed.' }] }; }
  };
  server.registerTool('gmi_list_models', { description: 'List available GMI LLM models.', inputSchema: {}, annotations: read }, () => run(() => client.listModels()));
  server.registerTool('gmi_chat_completion', {
    description: 'Generate a non-streaming text chat completion. Consumes paid inference credits; confirm model and intent first.',
    inputSchema: {
      model: z.string().trim().min(1),
      messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })).min(1),
      max_tokens: z.number().int().positive().optional(),
      temperature: z.number().min(0).max(2).optional(),
    }, annotations: write,
  }, (input) => run(() => client.chat(input)));
  server.registerTool('gmi_list_media_models', { description: 'List request-queue media model IDs.', inputSchema: {}, annotations: read }, () => run(() => client.listMediaModels()));
  server.registerTool('gmi_get_media_model', { description: 'Read a media model schema and parameters before submitting generation.', inputSchema: { model: z.string().trim().min(1) }, annotations: read }, ({ model }) => run(() => client.mediaModel(model)));
  server.registerTool('gmi_submit_media', {
    description: 'Enqueue image/video generation using the chosen model schema. Consumes credits; get user approval before submitting. Returns request_id, not finished media. Do not automatically retry.',
    inputSchema: { model: z.string().trim().min(1), payload: z.record(z.string(), z.unknown()) }, annotations: write,
  }, ({ model, payload }) => run(() => client.submitMedia(model, payload)));
  server.registerTool('gmi_check_media', { description: 'Check one queued request and return status and outcome artifact links, without polling or downloading files.', inputSchema: { request_id: z.string().trim().min(1) }, annotations: read }, ({ request_id }) => run(() => client.checkMedia(request_id)));
  return server;
}
