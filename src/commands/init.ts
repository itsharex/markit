import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OutputOptions } from "../utils/output.js";
import { output, success, hint, cmd } from "../utils/output.js";
import type { MillConfig } from "../config.js";

const DATA_DIR = ".mill";

export async function init(
  _args: string[],
  options: OutputOptions,
): Promise<void> {
  const root = join(process.cwd(), DATA_DIR);

  if (existsSync(root)) {
    output(options, {
      json: () => ({ success: true, path: root, message: "already_exists" }),
      human: () => success(`.mill/ already exists`),
    });
    return;
  }

  mkdirSync(root, { recursive: true });

  const config: MillConfig = {
    llm: {
      model: "gpt-4o",
      transcriptionModel: "whisper-1",
    },
  };

  writeFileSync(
    join(root, "config.json"),
    `${JSON.stringify(config, null, 2)}\n`,
  );

  output(options, {
    json: () => ({ success: true, path: root }),
    human: () => {
      success(`Created .mill/ in ${process.cwd()}`);
      hint("Set your API key for image/audio AI features:");
      console.log(`  ${cmd("export OPENAI_API_KEY=sk-...")}`);
      hint("Or configure directly:");
      console.log(`  ${cmd("mill config set llm.apiKey sk-...")}`);
    },
  });
}
