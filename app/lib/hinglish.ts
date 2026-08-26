import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { registerCanceler } from "@/app/lib/jobRegistry";
import { resolvePythonTool } from "@/app/lib/pythonRuntime";

const execFileAsync = promisify(execFile);

export async function convertToHinglish(texts: string[], jobId?: string): Promise<string[]> {
  const { command, args } = resolvePythonTool("hinglish", "scripts/hinglish.py");
  const execution = execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 50,
  });
  const child = execution.child;

  let unregister: (() => void) | undefined;
  if (jobId) {
    unregister = registerCanceler(jobId, () => child.kill("SIGTERM"));
    child.once("exit", () => unregister?.());
  }

  child.stdin!.write(JSON.stringify(texts));
  child.stdin!.end();

  try {
    const { stdout } = await execution;
    return JSON.parse(stdout) as string[];
  } finally {
    unregister?.();
  }
}
