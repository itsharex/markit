#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { convert } from "./commands/convert.js";
import { onboard } from "./commands/onboard.js";
import { formats } from "./commands/formats.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("mill")
  .description("Convert anything to markdown. Everything gets milled.")
  .version(`mill ${version}`, "-V, --version")
  .option("--json", "Output as JSON")
  .option("-q, --quiet", "Raw markdown only, no decoration")
  .addHelpText(
    "after",
    `
Examples:
  $ mill report.pdf                  Convert a PDF to markdown
  $ mill document.docx -o doc.md     Convert DOCX, write to file
  $ mill https://example.com         Convert a web page
  $ cat file.pdf | mill -            Read from stdin
  $ mill formats                     List supported formats

Docs: https://github.com/Michaelliv/mill`,
  );

program
  .command("convert")
  .alias("c")
  .description("Convert a file or URL to markdown")
  .argument("<source>", "File path, URL, or - for stdin")
  .option("-o, --output <file>", "Write to file instead of stdout")
  .action(async (source, opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    await convert(source, {
      json: globals.json,
      quiet: globals.quiet,
      output: opts.output,
    });
  });

program
  .command("formats")
  .description("List supported formats")
  .action(async (_opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    await formats([], { json: globals.json, quiet: globals.quiet });
  });

program
  .command("onboard")
  .description("Add mill instructions to CLAUDE.md or AGENTS.md")
  .action(async (_opts, cmd) => {
    const globals = cmd.optsWithGlobals();
    await onboard([], { json: globals.json, quiet: globals.quiet });
  });

// Default behavior: if first arg isn't a known subcommand, treat it as a source to convert
program.on("command:*", async (args) => {
  const source = args[0];
  if (!source) {
    program.help();
    return;
  }

  // Check for typos against known subcommands
  const commands = ["convert", "formats", "onboard", "help"];
  const close = commands.filter(
    (c) => levenshtein(source, c) <= 2 && source !== c,
  );
  if (
    close.length > 0 &&
    !source.includes("/") &&
    !source.includes(".") &&
    !source.startsWith("http")
  ) {
    const { error } = await import("./utils/output.js");
    error(`Unknown command '${source}'. Did you mean '${close[0]}'?`);
    process.exit(1);
  }

  const globals = program.opts();
  await convert(source, {
    json: globals.json,
    quiet: globals.quiet,
    output: globals.output,
  });
});

// No args → show concise help
if (process.argv.length <= 2) {
  console.log(`mill — convert anything to markdown

Usage:  mill <file-or-url> [options]

Examples:
  $ mill report.pdf
  $ mill document.docx -o doc.md
  $ mill https://example.com

Commands:
  mill formats     List supported formats
  mill onboard     Add instructions to CLAUDE.md

Run mill --help for all options.
Docs: https://github.com/Michaelliv/mill`);
  process.exit(0);
}

program.parseAsync(process.argv).catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0),
      );
    }
  }
  return dp[m][n];
}
