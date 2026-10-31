import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readJsonBody, secretMatches } from "./http-guards";

async function* chunks(...parts: string[]) {
  for (const part of parts) yield Buffer.from(part);
}

describe("secretMatches", () => {
  const secret = "a".repeat(40);

  it("accepts only the exact secret", () => {
    expect(secretMatches(secret, secret)).toBe(true);
    expect(secretMatches(`${secret}b`, secret)).toBe(false);
    expect(secretMatches("a".repeat(39), secret)).toBe(false);
    expect(secretMatches("", secret)).toBe(false);
  });
});

describe("readJsonBody", () => {
  it("parses JSON split across chunks", async () => {
    await expect(readJsonBody(chunks('{"a":', "1}"))).resolves.toEqual({ a: 1 });
  });

  it("returns undefined for an empty body", async () => {
    await expect(readJsonBody(chunks())).resolves.toBeUndefined();
  });

  it("refuses bodies over the limit", async () => {
    await expect(readJsonBody(chunks("x".repeat(6), "y".repeat(6)), 10)).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});
