import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { assertTarget, confirmProd, isLocalUrl, usesEnvFile, wantsProd } from "./pocketbase-target.mjs";

const PROD = "https://pb.example.com";

describe("isLocalUrl", () => {
  it("treats loopback and *.localhost as local", () => {
    for (const url of ["http://127.0.0.1:8090", "http://localhost:8090", "http://[::1]:8090", "http://dailytodo.localhost:5005"]) {
      expect(isLocalUrl(url), url).toBe(true);
    }
  });

  it("treats real hosts and junk as not local", () => {
    expect(isLocalUrl(PROD)).toBe(false);
    expect(isLocalUrl("https://localhost.evil.com")).toBe(false);
    expect(isLocalUrl("not a url")).toBe(false);
  });
});

describe("assertTarget", () => {
  it("lets a normal run use a local DB", () => {
    expect(assertTarget({ url: "http://127.0.0.1:8090", wantProd: false }).isLocal).toBe(true);
  });

  it("refuses prod without --prod", () => {
    expect(() => assertTarget({ url: PROD, wantProd: false })).toThrow(/would touch PROD \(pb\.example\.com\)/);
  });

  it("refuses --prod against a local DB", () => {
    expect(() => assertTarget({ url: "http://127.0.0.1:8090", wantProd: true })).toThrow(/target is local/);
  });

  it("allows --prod against prod (confirmation happens separately)", () => {
    expect(assertTarget({ url: PROD, wantProd: true }).isLocal).toBe(false);
  });

  it("refuses a missing URL", () => {
    expect(() => assertTarget({ url: "", wantProd: false })).toThrow(/Missing PocketBase URL/);
  });
});

describe("flags", () => {
  it("detects node --env-file (the :local scripts)", () => {
    expect(usesEnvFile(["--env-file=.env.test.local"])).toBe(true);
    expect(usesEnvFile(["--env-file", ".env.test.local"])).toBe(true);
    expect(usesEnvFile([])).toBe(false);
  });

  it("detects --prod", () => {
    expect(wantsProd(["node", "script.mjs", "--prod"])).toBe(true);
    expect(wantsProd(["node", "script.mjs"])).toBe(false);
  });
});

describe("confirmProd", () => {
  function terminal(answer: string) {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = new PassThrough();
    setTimeout(() => input.write(`${answer}\n`), 0);
    return { input, output };
  }

  it("refuses without a terminal (agents, CI, pipes)", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false });
    await expect(confirmProd(PROD, { input, output: new PassThrough() })).rejects.toThrow(/without a terminal/);
  });

  it("continues only when the human types prod", async () => {
    await expect(confirmProd(PROD, terminal("prod"))).resolves.toBeUndefined();
    await expect(confirmProd(PROD, terminal("yes"))).rejects.toThrow(/Cancelled/);
  });
});
