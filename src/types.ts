export interface StreamInfo {
  mimetype?: string;
  extension?: string;
  charset?: string;
  filename?: string;
  localPath?: string;
  url?: string;
}

export interface ConversionResult {
  markdown: string;
  title?: string;
}

export interface ConvertOptions {
  /** OpenAI-compatible client for image descriptions and audio transcription */
  llmClient?: LlmClient;
  /** Model to use for LLM operations (e.g. "gpt-4o") */
  llmModel?: string;
}

export interface LlmClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        messages: Array<{
          role: string;
          content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
        }>;
      }): Promise<{
        choices: Array<{ message: { content: string } }>;
      }>;
    };
  };
  audio?: {
    transcriptions: {
      create(params: {
        model: string;
        file: Blob;
      }): Promise<{ text: string }>;
    };
  };
}

export interface Converter {
  /** Human-readable name for error messages */
  name: string;

  /** Quick check: can this converter handle the given stream? */
  accepts(streamInfo: StreamInfo): boolean;

  /** Convert the source to markdown */
  convert(input: Buffer, streamInfo: StreamInfo, options?: ConvertOptions): Promise<ConversionResult>;
}
