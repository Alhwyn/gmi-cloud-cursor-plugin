---
name: integrate-inference
description: Integrate GMI Cloud OpenAI-compatible chat inference into a server-side application.
---

# Integrate GMI inference

1. Inspect the app's server runtime and existing SDK dependencies. Keep inference on the server; add the OpenAI SDK only if needed.
2. Set `GMI_CLOUD_API_KEY` in the runtime secret environment. Do not read or print its value. Fail fast if absent.
3. Use `gmi_list_models` to discover available IDs. Ask about latency, quality, budget, and modalities; consult https://docs.gmicloud.ai/model-quickstarts/text/overview for model-specific constraints.
4. Configure the client, adapting to the project's conventions:

```ts
import OpenAI from "openai";

const apiKey = process.env.GMI_CLOUD_API_KEY;
if (!apiKey) throw new Error("Set GMI_CLOUD_API_KEY");
const gmi = new OpenAI({ apiKey, baseURL: "https://api.gmi-serving.com/v1" });
// modelId must come from discovery / user configuration.
const result = await gmi.chat.completions.create({
  model: modelId,
  messages: [{ role: "user", content: "Hello!" }],
});
```

5. Ask before a live billable call. Use non-streaming first; expose only necessary response fields to clients. Do not log keys or private prompts.
6. Test with mocked success, empty choices, missing key, 401, 429, timeouts, and upstream failure. Never claim a mock proves live credentials work.

Reference: https://docs.gmicloud.ai/quickstart and https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference.
