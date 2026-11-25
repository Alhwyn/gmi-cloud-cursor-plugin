export type Tool = (name: string, args: Record<string, unknown>, timeoutMs?: number) => Promise<Record<string, unknown>>;
type Log = (message: string) => void;

export const mediaJobs = [
  {
    model: 'flux-kontext-pro',
    payload: { prompt: 'A red cube on a plain white background.', aspect_ratio: '1:1', prompt_upsampling: false },
  },
  {
    model: 'Veo3-Fast',
    payload: { prompt: 'A red cube slowly rotating on a plain white background.', durationSeconds: '4', aspectRatio: '16:9', personGeneration: 'disallow' },
  },
];

export function outputUrls(value: unknown): string[] {
  if (typeof value === 'string') return /^https?:\/\//.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(outputUrls);
  if (value && typeof value === 'object') return Object.values(value).flatMap(outputUrls);
  return [];
}

export async function runMedia(
  tool: Tool, job: typeof mediaJobs[number], log: Log,
  options: { now?: () => number; pause?: (ms: number) => Promise<void>; timeoutMs?: number } = {},
) {
  const now = options.now ?? Date.now;
  const pause = options.pause ?? ((ms) => Bun.sleep(ms));
  const deadline = now() + (options.timeoutMs ?? 600_000);
  let requestId = '(not returned)';
  let status = 'submission_error';
  try {
    const submitted = await tool('gmi_submit_media', job, Math.min(125_000, deadline - now()));
    if (typeof submitted.request_id !== 'string' || !submitted.request_id) throw new Error('Submission returned no request_id; do not retry automatically.');
    requestId = submitted.request_id;
    log(`model=${job.model} request_id=${requestId} submitted`);
    let result = submitted;
    while (true) {
      status = typeof result.status === 'string' ? result.status.toLowerCase() : 'unknown';
      if (['success', 'failed', 'cancelled'].includes(status)) {
        log(`model=${job.model} request_id=${requestId} final_status=${status} output_urls=${JSON.stringify(outputUrls(result.outcome))}`);
        return status === 'success';
      }
      if (!['queued', 'dispatched', 'processing', 'pending'].includes(status)) {
        throw new Error(`Unexpected queue status: ${status}`);
      }
      if (now() >= deadline) { status = 'timeout'; throw new Error('Polling deadline reached; job may still run.'); }
      await pause(Math.min(10_000, deadline - now()));
      if (now() >= deadline) { status = 'timeout'; throw new Error('Polling deadline reached; job may still run.'); }
      result = await tool('gmi_check_media', { request_id: requestId }, Math.min(125_000, deadline - now()));
    }
  } catch (error) {
    log(`model=${job.model} request_id=${requestId} final_status=${status === 'timeout' ? status : 'error'} last_status=${status} output_urls=[]`);
    throw error;
  }
}

export async function runLive(tool: Tool, log: Log = console.log) {
  const llms = await tool('gmi_list_models', {});
  const modelIds = Array.isArray(llms.data) ? llms.data.flatMap((model) =>
    model && typeof model === 'object' && typeof model.id === 'string' ? [model.id] : []) : [];
  log(`LLM models: ${JSON.stringify(modelIds)}`);
  if (!modelIds.length) throw new Error('No LLM models returned. No paid requests made.');
  const media = await tool('gmi_list_media_models', {});
  const mediaIds = Array.isArray(media.model_ids) ? media.model_ids : [];
  log(`Media models: ${JSON.stringify(mediaIds)}`);
  for (const job of mediaJobs) {
    if (!mediaIds.includes(job.model)) throw new Error(`Required media model ${job.model} unavailable; no paid requests made.`);
    await tool('gmi_get_media_model', { model: job.model });
  }
  const model = modelIds.find((id) => id === 'meta-llama/Llama-3.3-70B-Instruct') ?? modelIds[0];
  log(`Chat model=${model}`);
  const chat = await tool('gmi_chat_completion', {
    model, messages: [{ role: 'user', content: 'Reply with just: OK' }], max_tokens: 16,
  });
  log(`Chat completion received (${Array.isArray(chat.choices) ? chat.choices.length : 0} choices)`);
  let ok = Array.isArray(chat.choices) && chat.choices.length > 0;
  for (const job of mediaJobs) {
    try { if (!await runMedia(tool, job, log)) ok = false; }
    catch (error) { log(error instanceof Error ? error.message : 'Media request failed'); ok = false; }
  }
  if (!ok) throw new Error('Live integration failed; inspect final statuses above. Do not resubmit automatically.');
}
