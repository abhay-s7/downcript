import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { registerCanceler } from "@/app/lib/jobRegistry";

const execFileAsync = promisify(execFile);

// Same as execFileAsync, but when a jobId is given, the spawned child
// process is registered in the job registry so a "Cancel Processing"
// request can kill it mid-run instead of only abandoning the HTTP request.
export async function execFileTracked(
  jobId: string | undefined,
  file: string,
  args: string[],
  options: { maxBuffer?: number; timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const execution = execFileAsync(file, args, options);
  const child = execution.child;

  let unregister: (() => void) | undefined;
  if (jobId) {
    unregister = registerCanceler(jobId, () => child.kill("SIGTERM"));
    child.once("exit", () => unregister?.());
  }

  try {
    return await execution;
  } finally {
    unregister?.();
  }
}
