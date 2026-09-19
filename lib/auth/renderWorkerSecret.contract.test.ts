import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

describe("Render Worker shared secret client contracts", () => {
  it("live worker caller reads RENDER_WORKER_SHARED_SECRET", () => {
    const src = read("app/api/reels/render-vx/route.ts");
    assert.match(
      src,
      /const workerSecret =\s*String\(process\.env\.RENDER_WORKER_SHARED_SECRET \|\| ""\)\.trim\(\)/
    );
    assert.doesNotMatch(src, /NEXT_PUBLIC_RENDER_WORKER_SHARED_SECRET/);
  });

  it("exact header X-Autoaffi-Worker-Secret is sent", () => {
    const src = read("app/api/reels/render-vx/route.ts");
    const workerAt = src.indexOf("const res = await fetch(workerEndpoint");
    assert.ok(workerAt >= 0, "missing live fetch(workerEndpoint)");
    const workerFetch = src.slice(workerAt, workerAt + 550);
    assert.match(workerFetch, /"Content-Type": "application\/json"/);
    assert.match(
      workerFetch,
      /"X-Autoaffi-Worker-Secret": workerSecret/
    );
  });

  it("missing secret fails before fetch(workerEndpoint)", () => {
    const src = read("app/api/reels/render-vx/route.ts");
    const urlCheck = src.indexOf("if (!workerUrl)");
    const secretRead = src.indexOf(
      'String(process.env.RENDER_WORKER_SHARED_SECRET || "")'
    );
    const secretEmpty = src.indexOf("if (!workerSecret)");
    const fetchAt = src.indexOf("const res = await fetch(workerEndpoint");

    assert.ok(urlCheck >= 0);
    assert.ok(secretRead > urlCheck);
    assert.ok(secretEmpty > secretRead);
    assert.ok(fetchAt > secretEmpty);

    const failClosed = src.slice(secretEmpty, fetchAt);
    assert.match(failClosed, /upsertRenderJob\(/);
    assert.match(failClosed, /status: "failed"/);
    assert.match(failClosed, /errorMessage: "WORKER_UNAVAILABLE"/);
    assert.match(failClosed, /error: "WORKER_UNAVAILABLE"/);
    assert.match(failClosed, /status: 500/);
    assert.match(failClosed, /Worker authentication is not configured/);
    assert.doesNotMatch(failClosed, /await fetch\(workerEndpoint/);
    assert.doesNotMatch(failClosed, /RENDER_WORKER_SHARED_SECRET/);
  });

  it("no NEXT_PUBLIC worker secret exists", () => {
    const self = path.resolve(import.meta.dirname, "renderWorkerSecret.contract.test.ts");
    const files = walkFiles(root);
    for (const file of files) {
      if (file === self) continue;
      if (!/\.(ts|tsx|js|mjs|cjs|json|md|example|env)$/i.test(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(
        src,
        /NEXT_PUBLIC_[A-Z0-9_]*WORKER[A-Z0-9_]*SECRET/,
        file
      );
    }
  });

  it("browser Reels code does not gain access to secret", () => {
    const ui = read("components/reels/RenderVX.tsx");
    const page = read("app/login/dashboard/content-optimizer/reels/page.tsx");
    for (const src of [ui, page]) {
      assert.doesNotMatch(src, /RENDER_WORKER_SHARED_SECRET/);
      assert.doesNotMatch(src, /X-Autoaffi-Worker-Secret/);
      assert.doesNotMatch(src, /process\.env\.RENDER_WORKER/);
    }
  });

  it("app-owned jobId remains", () => {
    const src = read("app/api/reels/render-vx/route.ts");
    assert.match(src, /jobId = createRenderJobId\(\)/);
    assert.match(src, /job_id: params\.jobId/);
    assert.doesNotMatch(
      src,
      /jobId: normalizeText\(\(json as LooseRecord\)\?\.jobId/
    );
  });

  it("canonical userId remains", () => {
    const src = read("app/api/reels/render-vx/route.ts");
    const postStart = src.indexOf("export async function POST");
    const post = src.slice(postStart);
    assert.match(post, /requireUserIdOr401/);
    assert.match(post, /userId = auth\.userId/);
    assert.match(post, /void body\.userId/);
    assert.match(src, /user_id: params\.userId/);
  });

  it("render status remains user-owned", () => {
    const src = read("app/api/reels/render-vx/status/route.ts");
    assert.match(src, /requireUserIdOr401/);
    assert.match(src, /\.eq\("job_id", jobId\)/);
    assert.match(src, /\.eq\("user_id", userId\)/);
  });

  it("pipeline-runner remains untouched/dead", () => {
    const runner = read("app/api/reels/render-vx/pipeline-runner.ts");
    assert.match(runner, /export async function runPipeline/);
    assert.doesNotMatch(runner, /RENDER_WORKER_SHARED_SECRET/);
    assert.doesNotMatch(runner, /X-Autoaffi-Worker-Secret/);

    const self = path.resolve(import.meta.dirname, "renderWorkerSecret.contract.test.ts");
    const files = walkFiles(root);
    for (const file of files) {
      if (file === self) continue;
      if (file.endsWith(`${path.sep}pipeline-runner.ts`)) continue;
      if (!/\.(ts|tsx|js|mjs)$/i.test(file)) continue;
      const src = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(src, /pipeline-runner/, file);
      assert.doesNotMatch(src, /runPipeline/, file);
    }
  });
});
