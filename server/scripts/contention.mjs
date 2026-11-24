import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const composeFile = resolve(repositoryRoot, 'docker-compose.test.yml');
const resultsDirectory = resolve(repositoryRoot, 'tests/load/.results');
const projectName = 'quickview-contention-test';
const composeArgs = ['compose', '-f', composeFile, '-p', projectName];

const runCommand = (command, args) => new Promise((resolveRun, rejectRun) => {
  const child = spawn(command, args, { cwd: repositoryRoot, stdio: 'inherit' });
  child.once('error', rejectRun);
  child.once('close', (code) => resolveRun(code ?? 1));
});

const run = async () => {
  let failure;

  try {
    await rm(resultsDirectory, { recursive: true, force: true });
    await mkdir(resultsDirectory, { recursive: true });

    const resetCode = await runCommand('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans']);
    if (resetCode !== 0) {
      throw new Error(`Could not reset the test Compose project (exit ${resetCode}).`);
    }

    const upCode = await runCommand('docker', [
      ...composeArgs,
      'up',
      '--build',
      '--abort-on-container-exit',
      '--exit-code-from',
      'k6',
    ]);

    const verifyCode = await runCommand('docker', [...composeArgs, 'run', '--rm', 'verifier']);
    if (upCode !== 0) {
      throw new Error(`Contention stack exited with code ${upCode}.`);
    }
    if (verifyCode !== 0) {
      throw new Error(`Invariant verifier exited with code ${verifyCode}.`);
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      const downCode = await runCommand('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans']);
      if (downCode !== 0 && !failure) {
        failure = new Error(`Test volume teardown exited with code ${downCode}.`);
      }
    } catch (error) {
      if (!failure) failure = error;
    }

    await rm(resultsDirectory, { recursive: true, force: true }).catch((error) => {
      if (!failure) failure = error;
    });
  }

  if (failure) {
    console.error(`Contention test lifecycle failed: ${failure.message}`);
    process.exitCode = 1;
  }
};

await run();