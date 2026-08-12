import { spawn } from 'node:child_process';

const randomPort = 4000 + Math.floor(Math.random() * 1000);
const port = Number(process.env.SMOKE_PORT || randomPort);
const timeoutMs = 20000;

const smokeEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: String(port),
  SKIP_DB_CONNECT: 'true',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  TMDB_API_KEY: process.env.TMDB_API_KEY || 'Bearer smoke_test_token',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_smoke',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_smoke',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

const server = spawn('node', ['bootstrap.js'], {
  cwd: process.cwd(),
  env: smokeEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverExitCode = null;

server.on('exit', (code) => {
  serverExitCode = code;
});

server.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
});

server.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForHealth = async () => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (serverExitCode !== null) {
      throw new Error(`Server exited early with code ${serverExitCode}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health/live`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep retrying until timeout.
    }

    await wait(500);
  }

  throw new Error(`Server did not become healthy within ${timeoutMs}ms`);
};

const run = async () => {
  try {
    await waitForHealth();

    const live = await fetch(`http://127.0.0.1:${port}/health/live`);
    const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);

    if (live.status !== 200) {
      throw new Error(`/health/live returned ${live.status}`);
    }

    if (![200, 503].includes(ready.status)) {
      throw new Error(`/health/ready returned unexpected status ${ready.status}`);
    }

    console.log('Smoke test passed.');
  } finally {
    if (serverExitCode === null) {
      server.kill('SIGTERM');
      await wait(500);
    }
  }
};

run().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
});
