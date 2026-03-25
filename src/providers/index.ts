import type { Provider, ResolvedConfig } from "./types.js";
import type { MarkitOptions } from "../types.js";
import type { MarkitConfig } from "../config.js";
import { openai } from "./openai.js";
import { anthropic } from "./anthropic.js";

export type { Provider, ProviderConfig, ResolvedConfig } from "./types.js";

const providers: Record<string, Provider> = {
  openai,
  anthropic,
};

/**
 * Register a custom provider.
 */
export function registerProvider(provider: Provider): void {
  providers[provider.name] = provider;
}

/**
 * Get a provider by name.
 */
export function getProvider(name: string): Provider | undefined {
  return providers[name];
}

/**
 * List all registered provider names.
 */
export function listProviders(): string[] {
  return Object.keys(providers);
}

/**
 * Resolve config + env vars into a ResolvedConfig for a provider.
 */
function resolve(provider: Provider, config: MarkitConfig): ResolvedConfig | null {
  // API key: env vars (in provider priority order) > config file
  const apiKey =
    provider.envKeys.reduce<string | undefined>(
      (found, key) => found || process.env[key],
      undefined,
    ) || config.llm?.apiKey;

  if (!apiKey) return null;

  return {
    apiKey,
    apiBase: (config.llm?.apiBase || provider.defaultBase).replace(/\/+$/, ""),
    model: process.env.MARKIT_MODEL || config.llm?.model || provider.defaultModel,
    transcriptionModel: config.llm?.transcriptionModel || provider.defaultTranscriptionModel,
  };
}

/**
 * Build describe/transcribe functions from config.
 * Resolves provider, API key, model, and base URL automatically.
 */
export function createLlmFunctions(config: MarkitConfig): MarkitOptions {
  const providerName = config.llm?.provider || "openai";
  const provider = providers[providerName];

  if (!provider) {
    throw new Error(
      `Unknown provider '${providerName}'. Available: ${Object.keys(providers).join(", ")}`,
    );
  }

  const resolved = resolve(provider, config);
  if (!resolved) return {};

  return provider.create(resolved);
}
