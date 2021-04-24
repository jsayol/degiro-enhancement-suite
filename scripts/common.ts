import * as fs from "fs/promises";
import * as path from "path";
import * as mkdirp from "mkdirp";

export type Module = "login" | "trader";

export function listFiles(dir: string): Promise<string[]> {
  return fs.readdir(dir);
}

export async function readFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath, "utf8");
  return data.toString();
}
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await mkdirp(path.dirname(filePath));
  return fs.writeFile(filePath, content);
}

export function removeLastLines(content: string, numLines = 1): string {
  let lastNewlinePos = content.lastIndexOf("\n");

  while (numLines > 1) {
    lastNewlinePos = content.lastIndexOf("\n", lastNewlinePos - 1);
    numLines -= 1;
  }

    if (lastNewlinePos <= 0) {
      return content;
    }

  return content.substring(0, lastNewlinePos);
}
