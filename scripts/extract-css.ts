import * as path from "path";
import fetch from "node-fetch";
import {
  extractCSSClassesFromSourceMap,
  JSMAP_URL_REGEX,
  mergeStylesTrees,
  Module,
  SourceMap,
  StylesTree,
} from "../src/common";
import { listFiles, readFile, writeFile } from "./common";

const LOGIN_URL = "https://trader.degiro.nl/login/";
const TRADER_URL = "https://trader.degiro.nl/trader/";
const BASE_DIR = path.join(__dirname, "..", "src", "content", "styles");

interface ReversedStyles {
  [module: string]: { [chunk: string]: Array<[string, string]> };
}

async function extract(module: Module): Promise<void> {
  let chunkMapUrls: string[] = [];

  const pageUrl = module === "login" ? LOGIN_URL : TRADER_URL;
  const html = await fetch(pageUrl).then((r) => r.text());
  const scriptsMatch = html.matchAll(/src="(scripts\/([^"]+)\.([^"]+)\.js)"/g);

  if (!scriptsMatch) {
    throw new Error("Couldn't find scripts in html");
  }

  for (const [, src, chunkId] of scriptsMatch) {
    const mapUrl = pageUrl + src + ".map";
    if (chunkId === "runtime") {
      chunkMapUrls = [
        ...chunkMapUrls,
        ...(await processRuntimeSource(pageUrl, mapUrl)),
      ];
    } else {
      chunkMapUrls.push(mapUrl);
    }
  }

  const stylesTreeArray = await Promise.all(
    chunkMapUrls.map((url) =>
      extractCSSClassesFromSourceMap(url, JSMAP_URL_REGEX, fetch as any)
    )
  );

  const stylesTree = mergeStylesTrees(stylesTreeArray);
  classesToTemplate(module, reverseStyles(stylesTree));
}

async function processRuntimeSource(
  pageUrl: string,
  mapUrl: string
): Promise<string[]> {
  const urls: string[] = [];
  const sourcemap: SourceMap = await fetch(mapUrl).then((r) => r.json());
  const sourcePos = sourcemap.sources.findIndex((filepath) =>
    filepath.includes("get javascript chunk filename")
  );

  if (sourcePos < 0) {
    throw new Error(
      "Couldn't find webpack js chunk names file in runtime source map"
    );
  }

  const webpackChunks: string = sourcemap.sourcesContent[sourcePos];
  const chunksMatch = webpackChunks.match(/return ([^\{]+)(\{.+\})/);

  if (!chunksMatch) {
    throw new Error(
      "Couldn't find webpack js chunk names in runtime source map"
    );
  }

  const chunks: { [chunkId: string]: string } = JSON.parse(chunksMatch[2]);

  for (const chunkId in chunks) {
    urls.push(`${pageUrl}scripts/${chunkId}.${chunks[chunkId]}.js.map`);
  }

  return urls;
}

function reverseStyles(styles: StylesTree): ReversedStyles {
  const reversed: ReversedStyles = {};

  for (const moduleStr of ["login", "trader"]) {
    const module: Module = moduleStr as Module;

    if (!reversed[module]) {
      reversed[module] = {};
    }

    for (const chunk in styles[module]) {
      const chunkStyles: Array<[string, string]> = [];

      for (const style in styles[module][chunk]) {
        const classes = "." + styles[module][chunk][style].join(".");
        chunkStyles.push([classes, style]);
      }

      reversed[module][chunk] = chunkStyles;
    }
  }

  return reversed;
}

async function classesToTemplate(module: Module, styles: ReversedStyles) {
  const dir = path.join(BASE_DIR, module + "-unprocessed");
  const files = await listFiles(dir);
  const sharedStyles =
    module !== "login" ? styles[module]["app-shared-chunk"] : [];

  for (const file of files) {
    const [, chunk] = file.match(/(.+)\.scss/)!;
    const filePath = path.join(dir, file);
    const chunkStyles = chunk in styles[module] ? styles[module][chunk] : [];
    const combinedStyles = [...sharedStyles, ...chunkStyles];

    let content = await readFile(filePath);

    console.log(module, chunk);

    // The more classes it has, the sooner we have to apply it
    combinedStyles.sort((a, b) => (a[0].length < b[0].length ? 1 : -1));

    for (const [classes, styleName] of combinedStyles) {
      content = content.replaceAll(
        classes,
        `.\\@${styleName.replaceAll(":", "\\:")}\\@`
      );
    }

    const destFilePath = path.join(BASE_DIR, module, file);
    writeFile(destFilePath, content);
  }
}

// extract("login");
extract("trader");
