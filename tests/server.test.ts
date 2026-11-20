import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { GmiClient, LLM_BASE, MEDIA_BASE } from '../src/client.js';
import { createServer } from '../src/server.js';

async function fixture(fetcher: typeof fetch, key = 'test-key') {
  const server = createServer(new GmiClient(key, fetcher));
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

test('all tools route documented URLs, auth, and bodies; JSON is preserved', async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const f = await fixture(async (url, options) => {
    calls.push({ url: String(url), options: options! });
    return Response.json({ data: [], status: 'processing', outcome: null });
  });
  try {
    const cases = [
      ['gmi_list_models', {}, `${LLM_BASE}/models`, undefined],
      ['gmi_chat_completion', { model: 'model', messages: [{ role: 'user', content: 'Hello' }] }, `${LLM_BASE}/chat/completions`, { model: 'model', messages: [{ role: 'user', content: 'Hello' }], stream: false }],
      ['gmi_list_media_models', {}, `${MEDIA_BASE}/models`, undefined],
      ['gmi_get_media_model', { model: 'a/b' }, `${MEDIA_BASE}/models/a%2Fb`, undefined],
      ['gmi_submit_media', { model: 'Veo3', payload: { prompt: 'Eagle', durationSeconds: '8' } }, `${MEDIA_BASE}/requests`, { model: 'Veo3', payload: { prompt: 'Eagle', durationSeconds: '8' } }],
      ['gmi_check_media', { request_id: 'a/b' }, `${MEDIA_BASE}/requests/a%2Fb`, undefined],
    ] as const;
    for (const [name, args, url, body] of cases) {
      const result = await f.client.callTool({ name, arguments: args });
      assert.deepEqual(result.content, [{ type: 'text', text: JSON.stringify({ data: [], status: 'processing', outcome: null }) }]);
      const call = calls.at(-1)!;
      assert.equal(call.url, url);
      assert.equal(call.options.method, body ? 'POST' : 'GET');
      assert.equal((call.options.headers as Record<string, string>).Authorization, 'Bearer test-key');
      assert.equal(call.options.body, body ? JSON.stringify(body) : undefined);
      assert.ok(call.options.signal);
    }
  } finally { await f.close(); }
});

test('missing key, HTTP, network, and empty / invalid JSON errors are safe MCP errors', async () => {
  for (const scenario of ['key', '401', '429', '500', 'network', 'empty', 'invalid']) {
    let calls = 0;
    const f = await fixture(async () => {
      calls++;
      if (scenario === 'network') throw new Error('secret upstream detail');
      if (['401', '429', '500'].includes(scenario)) return new Response('secret upstream detail', { status: Number(scenario) });
      return new Response(scenario === 'invalid' ? 'not json' : '');
    }, scenario === 'key' ? '' : 'test-key');
    try {
      const result = await f.client.callTool({ name: 'gmi_list_models', arguments: {} });
      assert.equal(result.isError, true);
      assert.doesNotMatch(JSON.stringify(result), /secret upstream detail|test-key/);
      assert.equal(calls, scenario === 'key' ? 0 : 1);
    } finally { await f.close(); }
  }
});

test('empty lists and completed media outcomes remain intact', async () => {
  const outputs = [{ data: [] }, { model_ids: [] }, { status: 'success', outcome: { video_url: 'https://example.com/movie.mp4' } }];
  const f = await fixture(async () => Response.json(outputs.shift()));
  try {
    for (const [name, args, expected] of [
      ['gmi_list_models', {}, { data: [] }],
      ['gmi_list_media_models', {}, { model_ids: [] }],
      ['gmi_check_media', { request_id: 'id' }, { status: 'success', outcome: { video_url: 'https://example.com/movie.mp4' } }],
    ] as const) assert.deepEqual((await f.client.callTool({ name, arguments: args })).content, [{ type: 'text', text: JSON.stringify(expected) }]);
  } finally { await f.close(); }
});

test('invalid or empty required arguments never fetch', async () => {
  const f = await fixture(async () => { assert.fail('must not fetch'); });
  try {
    for (const [name, args] of [
      ['gmi_chat_completion', { model: '', messages: [] }],
      ['gmi_chat_completion', { model: 'm', messages: [{ role: 'user', content: 'Hi' }], temperature: 3 }],
      ['gmi_submit_media', { model: 'm', payload: null }],
      ['gmi_check_media', { request_id: ' ' }],
      ['gmi_get_media_model', {}],
    ] as const) assert.equal((await f.client.callTool({ name, arguments: args })).isError, true);
  } finally { await f.close(); }
});
