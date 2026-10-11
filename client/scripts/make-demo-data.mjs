// Builds the calls the read-only demo shows (src/demo/calls.json) by running the real
// app on the recordings in samples/demo/ (made by `python3 scripts/make_sample_calls.py
// --demo`): nothing in that file is typed by hand.
//
//   node scripts/make-demo-data.mjs
//
// Needs `ollama serve`; uses `npm run whisper` if it is running. The script starts its
// own copy of the app with empty in-browser storage, scores each recording, asks for a
// coaching note on each, then saves what the app stored. Run it again after changing the
// pipeline, the prompts or the scorecard, so the demo keeps showing what the app does.
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 5198;
const APP = `http://localhost:${PORT}/#/app`;
const SAMPLES = ["call-147.m4a", "call-148.m4a", "call-149.m4a", "call-150.m4a"];
const CHROME =
  process.env.CHROME ??
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : "/usr/bin/google-chrome");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const up = (url) => fetch(url, { signal: AbortSignal.timeout(1500) }).then((r) => r.status < 500, () => false);

if (!(await up("http://localhost:11434/api/tags"))) {
  console.error("Ollama is not running. Start it with `ollama serve` first.");
  process.exit(1);
}

const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: client,
  env: { ...process.env, LINEWISE_SERVER: "http://localhost:1" },
  stdio: "ignore",
  shell: process.platform === "win32",
});
process.on("exit", () => vite.kill());
for (let i = 0; i < 120 && !(await up(`http://localhost:${PORT}/`)); i++) await sleep(500);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: mkdtempSync(path.join(tmpdir(), "linewise-demo-data-")),
  args: ["--autoplay-policy=no-user-gesture-required"],
  protocolTimeout: 900_000,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const ready = () => page.waitForFunction(() => document.body.textContent?.includes("Local AI ready (Whisper + Ollama 3B)"), { timeout: 60_000 });
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await ready();
  const tab = (name) =>
    page.evaluate((label) => [...document.querySelectorAll("header nav button")].find((b) => b.textContent?.trim() === label)?.click(), name);

  const scoreOne = async (sample) => {
    await tab("Calls");
    await page.waitForSelector('[data-testid="upload"]');
    await page.$eval('[data-testid="upload"]', (el) => { el.value = ""; });
    await (await page.$('[data-testid="upload"]')).uploadFile(path.join(client, "samples", "demo", sample));
    await page.waitForSelector("button[data-testid^='transcribe-']", { timeout: 15_000 });
    const before = await page.$$eval("button[data-testid^='call-']", (els) => els.length);
    await page.click("button[data-testid^='transcribe-']");
    await page.waitForFunction((n) => document.querySelectorAll("button[data-testid^='call-']").length > n, { timeout: 600_000 }, before);

    // The newest call is first in the list: open it and ask for its coaching note.
    await page.click("button[data-testid^='call-']");
    await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Generate note"), { timeout: 15_000 });
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Generate note")?.click());
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Generate note") && !document.body.textContent?.includes("No note yet for this call."),
      { timeout: 180_000 },
    );
  };

  for (const sample of SAMPLES) {
    // The dev server reloads the page once the first time it meets the speech worker's
    // code, which drops the upload in progress. If that happens, start this one again.
    for (let attempt = 0; ; attempt++) {
      const reloaded = new Promise((resolve) => page.once("load", () => resolve("reloaded")));
      const outcome = await Promise.race([scoreOne(sample).then(() => "scored", (e) => e), reloaded]);
      if (outcome === "scored") break;
      if (attempt >= 2) throw outcome instanceof Error ? outcome : new Error(`${sample}: the page kept reloading.`);
      await sleep(1500);
      await ready();
    }
    console.log(`scored ${sample}`);
  }

  // Read back exactly what the app stored.
  const stored = await page.evaluate(async () => {
    const store = await import("/src/lib/store.local.ts");
    const calls = await store.loadAICalls();
    return Promise.all(calls.map(async ({ audio: _audio, ...call }) => ({ ...call, coaching: await store.getCoaching(call.id) })));
  });
  const calls = SAMPLES.map((sample) => {
    const call = stored.find((c) => c.name === sample);
    if (!call) throw new Error(`${sample} was not stored.`);
    return call;
  });
  mkdirSync(path.join(client, "src", "demo"), { recursive: true });
  writeFileSync(path.join(client, "src", "demo", "calls.json"), `${JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), calls }, null, 1)}\n`);
  for (const c of calls) console.log(`${c.name}: ${c.lines.length} lines, engine ${c.engine}, speakers ${c.speakers}, ${c.results.filter((r) => r.verdict === "fail").length} fails`);
} finally {
  await browser.close();
  vite.kill();
}
