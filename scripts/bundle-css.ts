import * as path from "path";
import * as sass from "sass";
import * as chokidar from "chokidar";
import { Module } from "../src/common";
import { listFiles, writeFile } from "./common";

const BASE_DIR = path.join(__dirname, "..", "src", "content", "styles");

const watch = process.argv[2] === "watch";

async function bundleModule(module: Module) {
  try {
    const moduleDir = path.join(BASE_DIR, module);
    const files = await listFiles(moduleDir, /.*\.scss$/);
    const bundle: { [k: string]: string } = {};
    const bundlePath = path.join(BASE_DIR, module + "-css.ts");

    for (const file of files) {
      const [chunk] = file.split(".");
      const sassResult = sass.renderSync({
        file: path.join(moduleDir, file),
        sourceMap: true,
        outputStyle: "compressed",
      });
      bundle[chunk] = sassResult.css.toString();
    }

    const bundleJSON = JSON.stringify(bundle, null, 2);
    await writeFile(bundlePath, "export default " + bundleJSON);
  } catch (err) {
    console.error(err);
  }
}

export async function bundle(): Promise<void> {
  await Promise.all([bundleModule("login"), bundleModule("trader")]);
}

function handleFileChange(filePath: string): void {
  const relativePath = path.relative(BASE_DIR, filePath);
  const module = path.dirname(relativePath) as Module;
  console.log(`[CHANGE] ${module} (${relativePath})`);
  bundleModule(module);
}

if (!watch) {
  bundle();
} else {
  const watcher = chokidar.watch(BASE_DIR, {
    persistent: true,
    ignored: ["*-unprocessed/**/*", /\.ts$/],
    ignoreInitial: true,
  });

  watcher
    .on("ready", () => console.log("Watching files"))
    .on("add", handleFileChange)
    .on("change", handleFileChange)
    .on("unlink", handleFileChange);

  if (process.platform === "win32") {
    var readline = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.on("SIGINT", function () {
      process.emit("SIGINT" as any);
    });
  }

  process.on("SIGINT", function () {
    process.exit();
  });
}
