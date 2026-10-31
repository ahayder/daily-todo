import { createHash, timingSafeEqual } from "node:crypto";

/** Max JSON body for one MCP request. Real tool calls are a few KB; transcripts stay well below this. */
export const MAX_BODY_BYTES = 1024 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super(`Request body is larger than ${MAX_BODY_BYTES} bytes.`);
  }
}

/**
 * Constant-time secret check. Both sides are hashed first, so the compare
 * always runs on equal-length buffers and doesn't reveal the secret's length.
 */
export function secretMatches(candidate: string, secret: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Reads a JSON body, refusing anything over `limit` bytes. */
export async function readJsonBody(chunks: AsyncIterable<Buffer | string>, limit = MAX_BODY_BYTES): Promise<unknown> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > limit) throw new BodyTooLargeError();
    parts.push(buffer);
  }
  const text = Buffer.concat(parts).toString("utf8");
  return text ? JSON.parse(text) : undefined;
}
