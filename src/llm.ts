import type { LlmClient } from "./types.js";
import type { MillConfig } from "./config.js";
import { resolveApiKey, resolveApiBase, resolveTranscriptionModel } from "./config.js";

/**
 * Build an OpenAI-compatible LLM client from config + env vars.
 * Returns null if no API key is available.
 * Uses raw fetch — no openai SDK dependency.
 */
export function createLlmClient(config: MillConfig): LlmClient | null {
  const apiKey = resolveApiKey(config);
  if (!apiKey) return null;

  const baseUrl = resolveApiBase(config).replace(/\/+$/, "");
  const transcriptionModel = resolveTranscriptionModel(config);

  return {
    chat: {
      completions: {
        async create(params) {
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: params.model,
              messages: params.messages,
              max_tokens: 1024,
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`LLM API error ${res.status}: ${body}`);
          }

          return res.json() as any;
        },
      },
    },
    audio: {
      transcriptions: {
        async create(params) {
          const formData = new FormData();
          formData.append("model", params.model || transcriptionModel);
          formData.append("file", params.file, "audio.mp3");

          const res = await fetch(`${baseUrl}/audio/transcriptions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            body: formData,
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`Transcription API error ${res.status}: ${body}`);
          }

          return res.json() as any;
        },
      },
    },
  };
}
