import mammoth from "mammoth";
import type { ConversionResult, Converter, StreamInfo } from "../types.js";
import { createTurndown, normalizeTablesHtml } from "../utils/turndown.js";

const EXTENSIONS = [".docx"];
const MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export class DocxConverter implements Converter {
  name = "docx";

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
    _streamInfo: StreamInfo,
  ): Promise<ConversionResult> {
    const { value: html } = await mammoth.convertToHtml({ buffer: input });
    const turndown = createTurndown();
    const markdown = turndown.turndown(normalizeTablesHtml(html));
    return { markdown: markdown.trim() };
  }
}
