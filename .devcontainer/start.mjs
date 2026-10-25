// Start once per Codespace and return after the application is actually ready.
import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const state = join(tmpdir(), `nordic-ficc-dev-${process.getuid?.() ?? 'user'}`);
mkdirSync(state, { recursive: true, mode: 0o700 });
const log = join(state, 'server.log');
const endpoint = 'http://127.0.0.1:3000/api/corporate-events';
async function ready() {
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    const payload = await response.json();
    return Array.isArray(payload.models) && ['demo', 'mixed'].includes(payload.mode);
  } catch { return false; }
}
if (await ready()) {
  console.log('Nordic FICC is already running on forwarded port 3000.');
  process.exit(0);
}
const output = openSync(log, 'a', 0o600);
const child = spawn('npm', ['run', 'dev'], {
  cwd: root, env: process.env, detached: true, stdio: ['ignore', output, output],
});
closeSync(output);
let failure;
child.on('error', error => { failure = error.message; });
child.unref();
if (child.pid) writeFileSync(join(state, 'server.pid'), String(child.pid), { mode: 0o600 });
for (let i = 0; i < 60; i++) {
  if (failure || child.exitCode !== null) break;
  if (await ready()) {
    console.log('Nordic FICC is ready. Open the Ports panel → port 3000 → Open in Browser.');
    console.log(`Development server log: ${log}`);
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (child.pid) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
}
throw new Error(`Development server did not become ready. ${failure || ''} Check ${log}; port 3000 must be available.`);
