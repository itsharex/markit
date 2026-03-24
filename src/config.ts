import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = ".mill";
const CONFIG_FILE = "config.json";

export interface MillConfig {
  llm?: {
    /** OpenAI-compatible API base URL (default: https://api.openai.com/v1) */
    apiBase?: string;
    /** API key — prefer env var OPENAI_API_KEY over storing here */
    apiKey?: string;
    /** Model for image descriptions (default: gpt-4o) */
    model?: string;
    /** Model for audio transcription (default: whisper-1) */
    transcriptionModel?: string;
  };
}

const DEFAULT_CONFIG: MillConfig = {};

/**
 * Walk up from cwd to find .mill/ directory.
 */
export function findConfigDir(): string | null {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, DATA_DIR))) {
      return join(dir, DATA_DIR);
    }
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Load config from .mill/config.json, merging with defaults.
 */
export function loadConfig(): MillConfig {
  const configDir = findConfigDir();
  if (!configDir) return { ...DEFAULT_CONFIG };

  const configFile = join(configDir, CONFIG_FILE);
  if (!existsSync(configFile)) return { ...DEFAULT_CONFIG };

  const raw = JSON.parse(readFileSync(configFile, "utf-8"));
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    llm: { ...DEFAULT_CONFIG.llm, ...raw.llm },
  };
}

/**
 * Save config to .mill/config.json. Creates .mill/ if needed.
 */
export function saveConfig(config: MillConfig): void {
  const configDir = findConfigDir();
  const dir = configDir || join(process.cwd(), DATA_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, CONFIG_FILE),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

/**
 * Resolve the API key. Precedence: env var > config file.
 * Checks: OPENAI_API_KEY, MILL_API_KEY
 */
export function resolveApiKey(config: MillConfig): string | undefined {
  return (
    process.env.OPENAI_API_KEY ||
    process.env.MILL_API_KEY ||
    config.llm?.apiKey
  );
}

/**
 * Resolve the API base URL. Precedence: env var > config file > default.
 */
export function resolveApiBase(config: MillConfig): string {
  return (
    process.env.OPENAI_API_BASE ||
    process.env.OPENAI_BASE_URL ||
    process.env.MILL_API_BASE ||
    config.llm?.apiBase ||
    "https://api.openai.com/v1"
  );
}

/**
 * Resolve the model. Precedence: flag > env var > config file > default.
 */
export function resolveModel(
  config: MillConfig,
  flagValue?: string,
): string {
  return (
    flagValue ||
    process.env.MILL_MODEL ||
    config.llm?.model ||
    "gpt-4o"
  );
}

/**
 * Resolve the transcription model.
 */
export function resolveTranscriptionModel(config: MillConfig): string {
  return config.llm?.transcriptionModel || "whisper-1";
}
