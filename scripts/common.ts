import * as fs from "fs/promises";
import * as path from "path";
import * as mkdirp from "mkdirp";

export async function listFiles(
  dir: string,
  pattern?: RegExp
): Promise<string[]> {
  const result = await fs.readdir(dir);

  if (!pattern) {
    return result;
  }

  return result.filter((file) => Boolean(file.match(pattern)));
}

// export async function listAllFiles(
//   dir: string,
//   pattern?: RegExp,
//   files: string[] = []
// ): Promise<string[]> {
//   const currentFiles = await fs.readdir(dir);

//   currentFiles.forEach(async (file) => {
//     const filePath = path.join(dir, file);
//     const stat = await fs.stat(filePath);

//     if (stat.isDirectory()) {
//       files = await listAllFiles(filePath, pattern, files);
//     } else if (!pattern || file.match(pattern)) {
//       files.push(path.join(__dirname, dir, file));
//     }
//   });

//   return files;
// }

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

// export function removeLastLines(content: string, numLines = 1): string {
//   let lastNewlinePos = content.lastIndexOf("\n");

//   while (numLines > 1) {
//     lastNewlinePos = content.lastIndexOf("\n", lastNewlinePos - 1);
//     numLines -= 1;
//   }

//   if (lastNewlinePos <= 0) {
//     return content;
//   }

//   return content.substring(0, lastNewlinePos);
// }
