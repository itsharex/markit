import type { Converter, ConversionResult, StreamInfo, ConvertOptions } from "../types.js";

const EXTENSIONS = [".mp3", ".wav", ".m4a", ".mp4", ".ogg", ".flac", ".aac", ".wma"];
const MIMETYPES = ["audio/", "video/mp4"];

export class AudioConverter implements Converter {
  name = "audio";

  accepts(streamInfo: StreamInfo): boolean {
    if (streamInfo.extension && EXTENSIONS.includes(streamInfo.extension)) return true;
    if (streamInfo.mimetype && MIMETYPES.some((m) => streamInfo.mimetype!.startsWith(m))) return true;
    return false;
  }

  async convert(input: Buffer, streamInfo: StreamInfo, options?: ConvertOptions): Promise<ConversionResult> {
    const sections: string[] = [];

    // Extract audio metadata
    try {
      const mm = await import("music-metadata");
      const metadata = await mm.parseBuffer(new Uint8Array(input), {
        mimeType: streamInfo.mimetype as any,
        size: input.length,
      });

      const { common, format } = metadata;

      sections.push("## Metadata\n");

      const fields: Record<string, string | undefined> = {
        Title: common.title,
        Artist: common.artist,
        Album: common.album,
        Genre: common.genre?.join(", "),
        Track: common.track?.no ? `${common.track.no}${common.track.of ? ` of ${common.track.of}` : ""}` : undefined,
        Year: common.year ? String(common.year) : undefined,
        Duration: format.duration
          ? this.formatDuration(format.duration)
          : undefined,
        Format: format.codec || format.container,
        SampleRate: format.sampleRate ? `${format.sampleRate} Hz` : undefined,
        Channels: format.numberOfChannels
          ? String(format.numberOfChannels)
          : undefined,
        Bitrate: format.bitrate
          ? `${Math.round(format.bitrate / 1000)} kbps`
          : undefined,
      };

      for (const [key, value] of Object.entries(fields)) {
        if (value) sections.push(`${key}: ${value}`);
      }

      // Lyrics if embedded
      if (common.lyrics?.length) {
        sections.push(`\n## Lyrics\n\n${common.lyrics.join("\n")}`);
      }
    } catch {
      // Metadata parsing failed
    }

    // Transcription via LLM (Whisper API)
    if (options?.llmClient?.audio?.transcriptions && options?.llmModel) {
      try {
        const transcript = await this.transcribe(
          input,
          streamInfo,
          options.llmClient,
        );
        if (transcript) {
          sections.push(`\n## Transcript\n\n${transcript}`);
        }
      } catch {
        // Transcription failed
      }
    }

    if (sections.length === 0) {
      return { markdown: `*[audio: ${streamInfo.filename || "unknown"}]*` };
    }

    return { markdown: sections.join("\n").trim() };
  }

  private async transcribe(
    input: Buffer,
    streamInfo: StreamInfo,
    client: NonNullable<ConvertOptions["llmClient"]>,
  ): Promise<string | undefined> {
    if (!client.audio?.transcriptions) return undefined;

    const mimetype = streamInfo.mimetype || this.guessMimetype(streamInfo.extension);
    const filename = streamInfo.filename || `audio${streamInfo.extension || ".mp3"}`;
    const file = new File([input], filename, { type: mimetype });

    const result = await client.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file,
    });

    return result.text || undefined;
  }

  private guessMimetype(ext?: string): string {
    const map: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".mp4": "video/mp4",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      ".aac": "audio/aac",
      ".wma": "audio/x-ms-wma",
    };
    return map[ext || ""] || "audio/mpeg";
  }

  private formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
}
