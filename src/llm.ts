import type { MarkitOptions } from "./types.js";
import type { MarkitConfig } from "./config.js";
import {
  resolveApiKey,
  resolveApiBase,
  resolveModel,
  resolveTranscriptionModel,
} from "./config.js";

/**
 * Build describe/transcribe functions from config + env vars.
 * Returns empty object if no API key is available.
 * Uses raw fetch against the OpenAI-compatible API — no SDK dependency.
 */
export function createLlmFunctions(config: MarkitConfig): MarkitOptions {
  const apiKey = resolveApiKey(config);
  if (!apiKey) return {};

  const baseUrl = resolveApiBase(config).replace(/\/+$/, "");
  const model = resolveModel(config);
  const transcriptionModel = resolveTranscriptionModel(config);

  return {
    async describe(image: Buffer, mimetype: string): Promise<string> {
      const base64 = image.toString("base64");
      const dataUri = `data:${mimetype};base64,${base64}`;

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Write a detailed description of this image.",
                },
                {
                  type: "image_url",
                  image_url: { url: dataUri },
                },
              ],
            },
          ],
          max_tokens: 1024,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`LLM API error ${res.status}: ${body}`);
      }

      const data: any = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    },

    async transcribe(audio: Buffer, mimetype: string): Promise<string> {
      const ext = mimeToExt(mimetype);
      const file = new File([audio], `audio${ext}`, { type: mimetype });

      const formData = new FormData();
      formData.append("model", transcriptionModel);
      formData.append("file", file);

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

      const data: any = await res.json();
      return data.text ?? "";
    },
  };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
    "video/mp4": ".mp4",
    "audio/ogg": ".ogg",
    "audio/flac": ".flac",
    "audio/aac": ".aac",
  };
  return map[mime] || ".mp3";
}
