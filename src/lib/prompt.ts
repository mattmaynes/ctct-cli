// Minimal interactive prompt (only used when stdin/stdout are a TTY).

import * as readline from 'readline';

export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
    return answer.trim();
  } finally {
    rl.close();
  }
}

export function canPrompt(): boolean {
  return !!process.stdin.isTTY && !!process.stderr.isTTY;
}
