import { browser } from "webextension-polyfill-ts";
import { hasProperty } from "../common";
import loginCss from "../content/styles/login-css";
import loginCSSBundle from "../content/styles/login-css";
import traderCSSBundle from "../content/styles/trader-css";

export const JS_URL_REGEX = /https?:\/\/trader.degiro.nl\/(login|trader)\/scripts\/([^\/]+)\.([^\.]+)\.js$/;
export const JSMAP_URL_REGEX = /https?:\/\/trader.degiro.nl\/(login|trader)\/scripts\/([^\/]+)\.([^\.]+)\.js\.map$/;

export type Module = "login" | "trader";

export type ModuleClasses = {
  [chunk: string]: { [style: string]: Array<string> };
};

export type StylesTree = {
  [module in Module]: ModuleClasses;
};

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

const EMPTY_STYLES_TREE: StylesTree = {
  login: {},
  trader: {},
};

let filesSeen: FilesSeen = new Set();
let baseThemeLoaded: { [tabId: number]: boolean } = {};
let stylesTree: StylesTree = EMPTY_STYLES_TREE;
let loginCSS: string;
let traderCSS: string;
let updateStorageTimeout: { [m: string]: ReturnType<typeof setTimeout> } = {};

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
      const [, sourceFileName] = map.sources[pos].match(/([^\/]+)\.css$/)!;
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
  updateBaseTheme();
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

  await prepareBaseTheme();

  console.log(stylesTree);
}

async function prepareBaseTheme() {
  let {
    loginCSS: storedLoginCSS,
    traderCSS: storedTraderCSS,
  } = (await browser.storage.local.get({
    loginCSS: "",
    traderCSS: "",
  })) as { [k: string]: string };

  if (storedLoginCSS === "") {
    const loginBundle = loginCSSBundle as { [chunk: string]: string };
    loginCSS = "";

    for (const chunk in loginBundle) {
      if (hasProperty(loginBundle, chunk)) {
        loginCSS += loginBundle[chunk] + "\n";
      }
    }

    await browser.storage.local.set({ loginCSS });
  } else {
    loginCSS = storedLoginCSS;
  }

  if (storedTraderCSS === "") {
    const traderBundle = traderCSSBundle as { [chunk: string]: string };
    traderCSS = "";

    for (const chunk in traderBundle) {
      if (hasProperty(traderBundle, chunk)) {
        traderCSS += traderBundle[chunk] + "\n";
      }
    }

    await browser.storage.local.set({ traderCSS });
  } else {
    traderCSS = storedTraderCSS;
  }

  console.log({ loginCSS });
}

export async function loadBaseTheme(tabId: number) {
  if (baseThemeLoaded[tabId]) {
    return;
  }

  baseThemeLoaded[tabId] = true;
  console.log("loadBaseTheme", { tabId: tabId, loginCSS });

  browser.tabs.insertCSS(tabId, { code: loginCSS, cssOrigin: "user" });
  browser.tabs.insertCSS(tabId, { code: traderCSS, cssOrigin: "user" });
}

export async function unloadBaseTheme(tabId: number) {
  if (!baseThemeLoaded[tabId]) {
    return;
  }

  delete baseThemeLoaded[tabId];
  console.log("unloadBaseTheme tabId=" + tabId);

  await Promise.all([
    browser.tabs.removeCSS(tabId, { code: loginCSS, cssOrigin: "user" }),
    browser.tabs.removeCSS(tabId, { code: traderCSS, cssOrigin: "user" }),
  ]);
}

export async function updateBaseTheme() {
  // TODO: if a tab is reloaded then baseThemeLoaded[tab.id] will
  // be true but the theme won't actually be loaded. Fix.
  // (also applies to loadBaseTheme & unloadBaseTheme)

  try {
    const tabs = await browser.tabs.query({ url: "*://trader.degiro.nl/*" });
    const tabsToUpdate: number[] = [];

    tabs.forEach(async (tab) => {
      try {
        if (tab && tab.id && baseThemeLoaded[tab.id]) {
          tabsToUpdate.push(tab.id);
        }
      } catch (err) {
        console.error(err);
      }
    });

    await Promise.all(tabsToUpdate.map((tabId) => unloadBaseTheme(tabId)));

    await Promise.all([
      updateBaseThemeForModule("login"),
      updateBaseThemeForModule("trader"),
    ]);

    await Promise.all(tabsToUpdate.map((tabId) => loadBaseTheme(tabId)));
  } catch (err) {
    console.error(err);
  }
}

async function updateBaseThemeForModule(module: Module) {
  const storageKey = module + "CSS";
  let css = module === "login" ? loginCSS : traderCSS;

  // const storageKey = module + "CSS";
  // let {
  //   [storageKey]: css,
  // }: { [k: string]: string } = await browser.storage.local.get({
  //   [storageKey]: "",
  // });

  const moduleStyles = stylesTree[module];
  for (const chunk in moduleStyles) {
    if (hasProperty(moduleStyles, chunk)) {
      const chunkStyles = moduleStyles[chunk];
      for (const style in chunkStyles) {
        if (hasProperty(chunkStyles, style)) {
          const classes = chunkStyles[style].join(".");
          const escapedStyle = `\\@${style.replace(":", "\\:")}\\@`;
          css = css.replaceAll(escapedStyle, classes);
        }
      }
    }
  }

  if (module === "login") {
    console.log({ [storageKey]: css });
  }

  clearTimeout(updateStorageTimeout[module]);

  updateStorageTimeout[module] = setTimeout(() => {
    browser.storage.local.set({ [storageKey]: css });
  }, 3000);

  // await browser.storage.local.set({ [storageKey]: css });
}

initialize();
