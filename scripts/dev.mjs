import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const isWin = process.platform === 'win32';

console.log('Starting backend (port 5000) and Vite (port 5173)...\n');

const server = spawn('node', ['server.js'], {
  stdio: 'inherit',
  cwd: root,
});

const vite = spawn(isWin ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  stdio: 'inherit',
  cwd: root,
  shell: isWin,
});

const shutdown = () => {
  server.kill();
  vite.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    vite.kill();
    process.exit(code ?? 1);
  }
});
