import { browser } from "webextension-polyfill-ts";
import { hasProperty } from "../common";
import loginCSSBundle from "../content/styles/login-css";
import traderCSSBundle from "../content/styles/trader-css";
import { tabIsReady } from "./common";

export const JS_URL_REGEX = new RegExp(
  "https?://trader\\.degiro\\.nl/(login|trader|beta-trader)/scripts/([^/]+)\\.([^\\.]+)\\.js$"
);
export const JSMAP_URL_REGEX = new RegExp(
  JS_URL_REGEX.source.replace(/\$$/, "\\.map$")
);

JS_URL_REGEX.source;

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
let stylesTree: StylesTree = EMPTY_STYLES_TREE;
let loginCSS: string;
let traderCSS: string;
let updateStorageTimeout: { [m: string]: ReturnType<typeof setTimeout> } = {};

const initialized = initialize();

async function initialize(): Promise<void> {
  await reset(); // TODO: !!!!!!!! REMOVE !!!!!!!!

  stylesTree = await getStyles();
  filesSeen = await getFilesSeen();

  await prepareBaseTheme();

  console.log("initialize", { stylesTree });
}

export async function reset(): Promise<void> {
  stylesTree = EMPTY_STYLES_TREE;
  filesSeen.clear();
  await storeStyles(stylesTree);
  await storeFilesSeen(filesSeen);

  // TODO: maybe put this into a separate function and only call
  // it when there is an extension update that requires it.
  await browser.storage.local.set({
    loginCSS: "",
    traderCSS: "",
  });
}

export async function applySourceMap(url: string): Promise<void> {
  await initialized;

  // TODO: uncomment this, temporary
  // if (filesSeen.has(url)) {
  //   return;
  // }

  const [, module, chunk] = url.match(JSMAP_URL_REGEX) as [any, Module, string];
  console.log("applySourceMap", { module, chunk, url });

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

  console.log("applySourceMap", { stylesTree });

  updateBaseTheme();
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

async function prepareBaseTheme(): Promise<void> {
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

export async function loadBaseTheme(
  tabId: number,
  module: Module
): Promise<void> {
  await initialized;

  console.log("loadBaseTheme", { tabId, module });
  const code = module === "login" ? loginCSS : traderCSS;
  await browser.tabs.insertCSS(tabId, { code, cssOrigin: "user" });
  await browser.tabs.sendMessage(tabId, { op: "baseThemeLoaded", module });
}

export async function unloadBaseTheme(
  tabId: number,
  module: Module
): Promise<void> {
  await initialized;

  console.log("unloadBaseTheme", { tabId, module });
  const code = module === "login" ? loginCSS : traderCSS;
  await browser.tabs.removeCSS(tabId, { code: loginCSS, cssOrigin: "user" });
  await browser.tabs.sendMessage(tabId, { op: "baseThemeUnloaded", module });
}

export async function updateBaseTheme(): Promise<void> {
  try {
    await initialized;

    const tabs = await browser.tabs.query({ url: "*://trader.degiro.nl/*" });

    const tabsThemeStatus = await Promise.all(
      tabs.map(
        async (
          tab
        ): Promise<{
          tabId: number;
          hasBaseTheme: { login: boolean; trader: boolean };
        }> => {
          try {
            await tabIsReady(tab.id!);
            const hasBaseTheme = await browser.tabs.sendMessage(tab.id!, {
              op: "hasBaseTheme",
            });
            return { tabId: tab.id!, hasBaseTheme };
          } catch (err) {
            console.error(err.message);
            throw err;
          }
        }
      )
    );

    await Promise.all(
      tabsThemeStatus.map(async (status) => {
        if (status.hasBaseTheme.login) {
          await unloadBaseTheme(status.tabId, "login");
        }
        if (status.hasBaseTheme.trader) {
          await unloadBaseTheme(status.tabId, "trader");
        }
      })
    );

    await Promise.all([
      updateBaseThemeForModule("login"),
      updateBaseThemeForModule("trader"),
    ]);

    await Promise.all(
      tabsThemeStatus.map(async (status) => {
        if (status.hasBaseTheme.login) {
          await loadBaseTheme(status.tabId, "login");
        }
        if (status.hasBaseTheme.trader) {
          await loadBaseTheme(status.tabId, "trader");
        }
      })
    );
  } catch (err) {
    console.error(err);
  }
}

async function updateBaseThemeForModule(module: Module) {
  const storageKey = module + "CSS";
  let css = module === "login" ? loginCSS : traderCSS;

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

  if (module === "login") {
    loginCSS = css;
  } else {
    traderCSS = css;
  }

  clearTimeout(updateStorageTimeout[module]);

  updateStorageTimeout[module] = setTimeout(() => {
    console.log("Update " + storageKey);
    browser.storage.local.set({ [storageKey]: css });
  }, 500);
}
