export const LLM_BASE = 'https://api.gmi-serving.com/v1';
export const MEDIA_BASE = 'https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey';

export class GmiClient {
  constructor(private readonly key = process.env.GMI_CLOUD_API_KEY, private readonly fetcher: typeof fetch = fetch) {}

  private async request(base: string, path: string, body?: unknown): Promise<unknown> {
    if (!this.key?.trim()) throw new Error('Set GMI_CLOUD_API_KEY before calling GMI Cloud tools.');
    let response: Response;
    try {
      response = await this.fetcher(`${base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${this.key}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new Error('GMI Cloud request failed (network error or timeout).');
    }
    if (!response.ok) throw new Error(`GMI Cloud HTTP ${response.status}. Check credentials, quota, and model parameters; requests are not retried.`);
    try { return await response.json(); }
    catch { throw new Error('GMI Cloud returned an empty or invalid JSON response.'); }
  }

  listModels() { return this.request(LLM_BASE, '/models'); }
  chat(input: { model: string; messages: { role: string; content: string }[]; max_tokens?: number; temperature?: number }) {
    return this.request(LLM_BASE, '/chat/completions', { ...input, stream: false });
  }
  listMediaModels() { return this.request(MEDIA_BASE, '/models'); }
  mediaModel(model: string) { return this.request(MEDIA_BASE, `/models/${encodeURIComponent(model)}`); }
  submitMedia(model: string, payload: Record<string, unknown>) { return this.request(MEDIA_BASE, '/requests', { model, payload }); }
  checkMedia(requestId: string) { return this.request(MEDIA_BASE, `/requests/${encodeURIComponent(requestId)}`); }
}
