---
name: pick-model
description: Select a GMI Cloud LLM or media model and safely submit asynchronous image or video generation.
---

# Choose a model and workflow

1. Clarify text versus image/video, input modalities, output requirements, latency, and budget. Do not assert undocumented pricing or benchmarks.
2. For chat call `gmi_list_models`; for media call `gmi_list_media_models`, then `gmi_get_media_model` for candidates. Read the returned schema, required fields, and model-specific docs. List results are not promises of account access.
3. Present a recommendation with tradeoffs and uncertainty. For text integrate with the OpenAI-compatible endpoint; use `gmi_chat_completion` only after approval for paid inference.
4. For media construct `{model, payload}` from that model's schema, not guessed universal image parameters. Show the user the chosen model and payload and get approval before `gmi_submit_media`.
5. Save the returned `request_id`. Use `gmi_check_media` to inspect status on request; do not tight-loop or resubmit a timed-out POST. The tools make a single request each. An enqueued/processing job is not finished. Return final outcome links as data; report failures and unexpected statuses honestly.
6. If implementing background polling in an app, use bounded exponential backoff, a deadline, and documented terminal states. Docs show both descriptive status wording and `success` in a sample: do not assume every non-success status is still running.

References:
- https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference
- https://docs.gmicloud.ai/model-quickstarts/image/reve-create-20250915
