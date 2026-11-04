import assert from "node:assert/strict";
import { mkdtempSync, chmodSync, symlinkSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { assertKeyFileOutsideRepo, readTestKey, SandboxError } from "./stripeSandbox.ts";

// WSL/Linux suite. Not part of test:auth. Requires POSIX modes and Unix symlinks.
assert.equal(process.platform, "linux", "STRIPE_SANDBOX_POSIX_REQUIRED");

const FIXTURE_KEY = "sk_test_unitfixture";

function sandboxError(run: () => unknown): SandboxError {
  let caught: unknown;
  try {
    run();
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof SandboxError);
  return caught;
}

describe("stripe sandbox POSIX key file guards", () => {
  it("accepts a 0600 key file outside the repo and follows symlinks before deciding", () => {
    const repo = mkdtempSync(path.join(tmpdir(), "sandbox-repo-"));
    const outside = mkdtempSync(path.join(tmpdir(), "sandbox-keys-"));
    const outsideKey = path.join(outside, "key");
    const insideKey = path.join(repo, "key");
    try {
      writeFileSync(outsideKey, `${FIXTURE_KEY}\n`, { mode: 0o600 });
      writeFileSync(insideKey, `${FIXTURE_KEY}\n`, { mode: 0o600 });
      assert.equal(readTestKey(assertKeyFileOutsideRepo(outsideKey, repo)), FIXTURE_KEY);

      const linkInside = path.join(repo, "link-out");
      symlinkSync(outsideKey, linkInside);
      assert.equal(assertKeyFileOutsideRepo(linkInside, repo), outsideKey);

      const linkOutside = path.join(outside, "link-in");
      symlinkSync(insideKey, linkOutside);
      assert.equal(sandboxError(() => assertKeyFileOutsideRepo(linkOutside, repo)).code, "STRIPE_SANDBOX_KEY_FILE_INSIDE_REPO");
      assert.equal(sandboxError(() => assertKeyFileOutsideRepo(insideKey, repo)).code, "STRIPE_SANDBOX_KEY_FILE_INSIDE_REPO");

      chmodSync(outsideKey, 0o644);
      assert.equal(sandboxError(() => assertKeyFileOutsideRepo(outsideKey, repo)).code, "STRIPE_SANDBOX_KEY_FILE_MODE");
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
