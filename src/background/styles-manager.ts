import { browser } from "webextension-polyfill-ts";
import { getKnownAppVersion, hasProperty } from "../common";

export const JS_URL_REGEX = /\/(login|trader)\/scripts\/([^\/]+)\.([^\.]+)\.js$/;
export const JSMAP_URL_REGEX = /\/(login|trader)\/scripts\/([^\/]+)\.([^\.]+)\.js\.map$/;

interface SourceMap {
  version: number;
  sources: Array<string>;
  names: Array<string>;
  mappings: string;
  file: string;
  sourcesContent: Array<string>;
  sourceRoot: string;
}

type FilesSeen = Set<string>;
let filesSeen: FilesSeen = new Set();

export type Module = "login" | "trader";
export type ModuleClasses = {
  [chunk: string]: { [style: string]: Array<string> };
};
export type StylesTree = {
  [k in Module]: ModuleClasses;
};

const EMPTY_STYLES_TREE: StylesTree = {
  login: {},
  trader: {},
};

let stylesTree: StylesTree = EMPTY_STYLES_TREE;

export async function applySourceMap(url: string): Promise<void> {
  // if (filesSeen.has(url)) {
  //   return;
  // }

  const [, module, chunk] = url.match(JSMAP_URL_REGEX) as [any, Module, string];

  // Fetch the sourcemap
  const resp = await fetch(url);
  const map: SourceMap = await resp.json();

  // Extract the generated classnames from the sourcemap
  map.sourcesContent.forEach((fileSource, pos) => {
    const contentMatch = fileSource.match(
      /^\/\/ extracted by mini-css-extract-plugin\n((.|\n|\r)+)/
    );

    if (contentMatch) {
      const [, sourceFileName] = map.sources[pos].match(/([^\/]+)\.css$/);
      const content = contentMatch[1];
      content.split("\n").map((line) => {
        const lineMatch = line.match(/export const ([^ ]+) = "(.+)";/);
        if (lineMatch) {
          let key = sourceFileName + ":" + lineMatch[1];
          const classes = lineMatch[2].split(" ");

          if (!hasProperty(stylesTree, module)) {
            stylesTree[module] = {};
          }

          if (!hasProperty(stylesTree[module], chunk)) {
            stylesTree[module][chunk] = {};
          }

          stylesTree[module][chunk][key] = classes;
        }
      });
    }
  });

  // Add this URL to the list of files we've already seen and processed
  filesSeen.add(url);

  // Save changes to storage
  await storeStyles(stylesTree);
  await storeFilesSeen(filesSeen);

  console.log(stylesTree);

  // TODO: process theme stylesheet template with the new styles
}

export function reset(): void {
  stylesTree = EMPTY_STYLES_TREE;
  filesSeen.clear();
  storeStyles(stylesTree);
  storeFilesSeen(filesSeen);
}

async function getStyles(): Promise<StylesTree> {
  const result = await browser.storage.local.get({ styles: EMPTY_STYLES_TREE });
  console.log(result);
  return result.styles;
}

async function storeStyles(styles: StylesTree): Promise<void> {
  return browser.storage.local.set({ styles });
}

async function getFilesSeen(): Promise<FilesSeen> {
  const result = await browser.storage.local.get({ filesSeen: [] });
  console.log({ getFilesSeen: result });
  return new Set(result.filesSeen);
}

async function storeFilesSeen(filesSeen: FilesSeen): Promise<void> {
  return browser.storage.local.set({ filesSeen: [...filesSeen] });
}

async function initialize() {
  reset(); // TODO: !!!!!!!! REMOVE !!!!!!!!

  stylesTree = await getStyles();
  filesSeen = await getFilesSeen();

  console.log(stylesTree);
}

initialize();
