import * as path from "path";
import {
  listFiles,
  Module,
  readFile,
  removeLastLines,
  writeFile,
} from "./common";

const distEnv = process.argv[2];

if (!["dev", "prod"].includes(distEnv)) {
  console.error('Specify either "dev" or "prod"');
  process.exit(1);
}

const baseDir = path.join(
  __dirname,
  "..",
  "dist",
  distEnv,
  "content",
  "styles-new"
);

async function bundle(module: Module) {
  try {
    const moduleDir = path.join(baseDir, module);
    const files = await listFiles(moduleDir);
    const bundle: { [k: string]: string } = {};

    for (const file of files) {
      const fileMatch = file.match(/(.+)\.css/);
      if (fileMatch) {
        const chunk = fileMatch[1];
        const content = await readFile(path.join(moduleDir, file));
        bundle[chunk] = removeLastLines(content, 2);
      }
    }

    const bundlePath = path.join(baseDir, module + "-css.json");
    const bundleJSON =
      distEnv === "prod"
        ? JSON.stringify(bundle)
        : JSON.stringify(bundle, null, 2);

    await writeFile(bundlePath, bundleJSON);
  } catch (err) {
    console.error(err);
  }
}

bundle("login");
bundle("trader");
