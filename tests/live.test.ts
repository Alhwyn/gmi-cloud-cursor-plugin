import { test, expect } from 'bun:test';
import { runLive, runMedia, mediaJobs, outputUrls, type Tool } from '../scripts/live-flow.ts';

test('media polls via tools and reports final status, request id and nested URLs', async () => {
  const calls: string[] = [];
  const logs: string[] = [];
  const tool: Tool = async (name) => {
    calls.push(name);
    return name === 'gmi_submit_media' ? { request_id: 'job', status: 'queued' } :
      { status: 'success', outcome: { media_urls: [{ url: 'https://example.com/image.png' }] } };
  };
  expect(await runMedia(tool, mediaJobs[0], (line) => logs.push(line), { pause: async () => {} })).toBe(true);
  expect(calls).toEqual(['gmi_submit_media', 'gmi_check_media']);
  expect(logs.at(-1)).toContain('request_id=job final_status=success');
  expect(logs.at(-1)).toContain('https://example.com/image.png');
  expect(outputUrls(null)).toEqual([]);
});

test('media failures, missing request IDs, unknown statuses and timeout never resubmit', async () => {
  for (const status of ['failed', 'cancelled', 'unknown', 'queued', 'missing', 'error']) {
    let calls = 0;
    let time = 0;
    const logs: string[] = [];
    const tool: Tool = async () => {
      calls++;
      if (status === 'error') throw new Error('HTTP 429');
      return { ...(status === 'missing' ? {} : { request_id: 'job' }), status };
    };
    const result = runMedia(tool, mediaJobs[1], (line) => logs.push(line), {
      now: () => time, pause: async (ms) => { time += ms; }, timeoutMs: 20,
    });
    if (['failed', 'cancelled'].includes(status)) expect(await result).toBe(false);
    else await expect(result).rejects.toThrow();
    expect(calls).toBe(1);
    expect(logs.at(-1)).toContain('final_status=');
  }
});

test('live preflight rejects empty model lists or missing media without paid requests', async () => {
  for (const empty of [true, false]) {
    const calls: string[] = [];
    await expect(runLive(async (name) => {
      calls.push(name);
      return name === 'gmi_list_models' ? { data: empty ? [] : [{ id: 'llm' }] } : { model_ids: [] };
    }, () => {})).rejects.toThrow();
    expect(calls.every((name) => name.includes('list'))).toBe(true);
  }
});

test('live flow makes one chat and attempts both media jobs even if the image fails', async () => {
  const submitted: unknown[] = [];
  let chats = 0;
  await expect(runLive(async (name, args) => {
    if (name === 'gmi_list_models') return { data: [{ id: 'llm' }] };
    if (name === 'gmi_list_media_models') return { model_ids: mediaJobs.map((job) => job.model) };
    if (name === 'gmi_get_media_model') return {};
    if (name === 'gmi_chat_completion') { chats++; return { choices: [{}] }; }
    submitted.push(args);
    return { request_id: 'job', status: args.model === mediaJobs[0].model ? 'failed' : 'success' };
  }, () => {})).rejects.toThrow('Live integration failed');
  expect(chats).toBe(1);
  expect(submitted).toEqual(mediaJobs);
});

test('live entrypoint skips cleanly without a key', async () => {
  const child = Bun.spawn([process.execPath, 'scripts/live.ts'], {
    cwd: new URL('../', import.meta.url).pathname, env: { ...process.env, GMI_CLOUD_API_KEY: '' }, stdout: 'pipe',
  });
  expect(await new Response(child.stdout).text()).toContain('SKIP: GMI_CLOUD_API_KEY is unset; no live requests made.');
  expect(await child.exited).toBe(0);
});
