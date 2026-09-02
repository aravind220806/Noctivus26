const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

function findPython() {
  const isWin = process.platform === 'win32';

  // 1. Check local backend/.venv
  const backendVenv = isWin
    ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDir, '.venv', 'bin', 'python');
  if (fs.existsSync(backendVenv)) {
    return { cmd: backendVenv, args: [] };
  }

  // 2. Check root .venv
  const rootVenv = isWin
    ? path.join(rootDir, '.venv', 'Scripts', 'python.exe')
    : path.join(rootDir, '.venv', 'bin', 'python');
  if (fs.existsSync(rootVenv)) {
    return { cmd: rootVenv, args: [] };
  }

  // 3. Fallbacks: python3, python, py
  if (isWin) {
    return { cmd: 'py', args: ['-3'] };
  }
  return { cmd: 'python3', args: [] };
}

const userArgs = process.argv.slice(2);
const scriptArgs = userArgs.length > 0 ? userArgs : ['run.py'];
const { cmd, args } = findPython();
const fullArgs = [...args, ...scriptArgs];

const child = spawn(cmd, fullArgs, {
  cwd: backendDir,
  stdio: 'inherit',
  shell: false,
  env: { ...process.env },
});

child.on('exit', (code, signal) => {
  if (code !== null) process.exit(code);
  if (signal) process.kill(process.pid, signal);
});
