import type { Converter, ConversionResult, StreamInfo, ConvertOptions } from "../types.js";

const EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif", ".bmp", ".svg"];
const MIMETYPES = ["image/"];

export class ImageConverter implements Converter {
  name = "image";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) return true;
    if (streamInfo.mimetype && MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))) return true;
    return false;
  }

  async convert(input: Buffer, streamInfo: StreamInfo, options?: ConvertOptions): Promise<ConversionResult> {
    const sections: string[] = [];

    // Extract EXIF metadata
    try {
      const exifr = await import("exifr");
      const metadata = await exifr.parse(input, {
        // Pick useful fields
        pick: [
          "ImageWidth", "ImageHeight", "Make", "Model",
          "DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude",
          "Artist", "Copyright", "Description", "Title",
          "Keywords", "Software", "ExposureTime", "FNumber",
          "ISO", "FocalLength",
        ],
      });

      if (metadata && Object.keys(metadata).length > 0) {
        sections.push("## Metadata\n");
        // Image dimensions
        if (metadata.ImageWidth && metadata.ImageHeight) {
          sections.push(`ImageSize: ${metadata.ImageWidth}x${metadata.ImageHeight}`);
        }
        // Key fields
        const fields: Record<string, string | undefined> = {
          Title: metadata.Title,
          Description: metadata.Description || metadata.ImageDescription,
          Keywords: Array.isArray(metadata.Keywords)
            ? metadata.Keywords.join(", ")
            : metadata.Keywords,
          Artist: metadata.Artist,
          Copyright: metadata.Copyright,
          Camera: [metadata.Make, metadata.Model].filter(Boolean).join(" "),
          DateTimeOriginal: metadata.DateTimeOriginal
            ? String(metadata.DateTimeOriginal)
            : undefined,
          CreateDate: metadata.CreateDate
            ? String(metadata.CreateDate)
            : undefined,
          GPS: metadata.GPSLatitude && metadata.GPSLongitude
            ? `${metadata.GPSLatitude}, ${metadata.GPSLongitude}`
            : undefined,
          ExposureTime: metadata.ExposureTime
            ? `1/${Math.round(1 / metadata.ExposureTime)}s`
            : undefined,
          FNumber: metadata.FNumber ? `f/${metadata.FNumber}` : undefined,
          ISO: metadata.ISO ? String(metadata.ISO) : undefined,
          FocalLength: metadata.FocalLength
            ? `${metadata.FocalLength}mm`
            : undefined,
          Software: metadata.Software,
        };

        for (const [key, value] of Object.entries(fields)) {
          if (value) sections.push(`${key}: ${value}`);
        }
      }
    } catch {
      // EXIF parsing failed — not all images have EXIF
    }

    // LLM description (if configured)
    if (options?.llmClient && options?.llmModel) {
      try {
        const description = await this.describeWithLlm(
          input,
          streamInfo,
          options.llmClient,
          options.llmModel,
        );
        if (description) {
          sections.push(`\n## Description\n\n${description}`);
        }
      } catch {
        // LLM description failed — continue without it
      }
    }

    if (sections.length === 0) {
      return { markdown: `*[image: ${streamInfo.filename || "unknown"}]*` };
    }

    return { markdown: sections.join("\n").trim() };
  }

  private async describeWithLlm(
    input: Buffer,
    streamInfo: StreamInfo,
    client: NonNullable<ConvertOptions["llmClient"]>,
    model: string,
  ): Promise<string | undefined> {
    const mimetype = streamInfo.mimetype || this.guessMimetype(streamInfo.extension);
    const base64 = input.toString("base64");
    const dataUri = `data:${mimetype};base64,${base64}`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Write a detailed description of this image." },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
    });

    return response.choices[0]?.message?.content ?? undefined;
  }

  private guessMimetype(ext?: string): string {
    const map: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".tiff": "image/tiff",
      ".tif": "image/tiff",
      ".bmp": "image/bmp",
      ".svg": "image/svg+xml",
    };
    return map[ext || ""] || "image/png";
  }
}
