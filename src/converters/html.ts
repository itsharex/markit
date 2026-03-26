import type { ConversionResult, Converter, StreamInfo } from "../types.js";
import { createTurndown, normalizeTablesHtml } from "../utils/turndown.js";

const EXTENSIONS = [".html", ".htm"];
const MIMETYPES = ["text/html", "application/xhtml"];

export class HtmlConverter implements Converter {
  name = "html";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) {
      return true;
    }
    if (
      streamInfo.mimetype &&
      MIMETYPES.some((m) => streamInfo.mimetype?.startsWith(m))
    ) {
      return true;
    }
    return false;
  }

  async convert(
    input: Buffer,
    streamInfo: StreamInfo,
  ): Promise<ConversionResult> {
    const charset = streamInfo.charset || "utf-8";
    const html = new TextDecoder(charset).decode(input);

    const turndown = createTurndown();

    // Remove script and style tags before converting
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");

    const markdown = turndown.turndown(normalizeTablesHtml(cleaned));

    // Try to extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    return { markdown: markdown.trim(), title };
  }
}
