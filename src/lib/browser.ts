// Best-effort "open this URL in the default browser" without an npm dependency.
// Failure is non-fatal: the caller always prints the URL for manual use.

import { spawn } from 'child_process';

export function openBrowser(url: string): void {
  let command: string;
  let args: string[];
  switch (process.platform) {
    case 'darwin':
      command = 'open';
      args = [url];
      break;
    case 'win32':
      command = 'cmd';
      args = ['/c', 'start', '', url];
      break;
    default:
      command = 'xdg-open';
      args = [url];
      break;
  }
  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {
      /* opener not available; caller shows the URL */
    });
    child.unref();
  } catch {
    /* ignore */
  }
}
