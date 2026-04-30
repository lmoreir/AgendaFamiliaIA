import OpenAI from "openai";
import { Readable } from "stream";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

/**
 * Transcreve um buffer de áudio usando o Whisper da OpenAI.
 * WhatsApp envia áudio em OGG/Opus — o Whisper aceita esse formato.
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const client = getClient();

  // Whisper precisa de um File-like object com nome e tipo
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "ogg";
  const uint8 = new Uint8Array(buffer);
  const file = new File([uint8], `audio.${ext}`, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "pt",
    response_format: "text",
  });

  return (response as unknown as string).trim();
}
