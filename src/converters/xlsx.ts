import type { Converter, ConversionResult, StreamInfo } from "../types.js";

const EXTENSIONS = [".xlsx", ".xls"];
const MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

export class XlsxConverter implements Converter {
  name = "xlsx";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) {
      return true;
    }
    if (
      streamInfo.mimetype &&
      MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))
    ) {
      return true;
    }
    return false;
  }

  async convert(input: Buffer, _streamInfo: StreamInfo): Promise<ConversionResult> {
    let XLSX: any;
    try {
      // @ts-ignore - xlsx is an optional dependency
      XLSX = await import("xlsx");
    } catch {
      throw new Error(
        "Excel support requires 'xlsx'. Install it: npm install xlsx",
      );
    }

    const workbook = XLSX.read(input, { type: "buffer" });
    const sections: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length === 0) continue;

      sections.push(`## ${sheetName}`);

      const [header, ...body] = rows;
      const headerStrs = header.map((c: unknown) => String(c ?? ""));

      const lines: string[] = [];
      lines.push(`| ${headerStrs.join(" | ")} |`);
      lines.push(`| ${headerStrs.map(() => "---").join(" | ")} |`);

      for (const row of body) {
        const cells = headerStrs.map((_, i) => String((row as unknown[])[i] ?? ""));
        lines.push(`| ${cells.join(" | ")} |`);
      }

      sections.push(lines.join("\n"));
    }

    return { markdown: sections.join("\n\n") };
  }
}
