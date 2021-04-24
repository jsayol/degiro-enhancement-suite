import { browser, Runtime } from "webextension-polyfill-ts";
import { Module } from "../../scripts/common";
import {
  // DegiroClient,
  // DegiroConfig,
  getRandomColor,
  Settings,
} from "../common";

// import * as loginCSSBundle from "./styles/login-css.json";
// import * as traderCSSBundle from "./styles/trader-css.json";

const BASE_THEME_ID = "--suite-theme-css";
// const CONFIG_URL = "https://trader.degiro.nl/login/secure/config";

const currentModule = getCurrentAppModule();
let connectionPort: Runtime.Port;
let currentTheme = "default";
let hasBaseTheme = {
  login: false,
  trader: false,
};
// let degiroData: {
//   config: DegiroConfig;
//   client: DegiroClient;
// };

/**
 * Monitor the connection to the extension's background page.
 * This allows us to detect if it get uninstalled or upgraded
 * so that we can do some cleanup.
 */
browser.runtime.onConnect.addListener((port) => {
  connectionPort = port;
  connectionPort.onDisconnect.addListener(cleanup);
});

async function initialize() {
  try {
    browser.runtime.onMessage.addListener(onMessageHandler);
    browser.runtime.sendMessage({ op: "tabReady" });

    const settings = await browser.runtime.sendMessage({ op: "getSettings" });
    handleSettingsUpdate(settings);

    await browser.runtime.sendMessage({ op: "activateIcon" });

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", colorSchemeChangeHandler);

    // If we're inside an iframe (quick order in popup) we mark
    // the page so that we can avoid applying themes for now.
    if (window.self !== window.top) {
      document.querySelector("html")!.dataset.suiteIframe = "true";
    }

    // fetchDegiroData();
  } catch (err) {
    console.error(err);
  }
}

function getCurrentAppModule(): Module {
  const hrefMatch = document.location.href.match(
    /https?:\/\/trader.degiro.nl\/(login|trader|beta-trader)\//
  );

  if (!hrefMatch) {
    throw new Error("Unknown app module for " + document.location.href);
  }

  return hrefMatch[1] === "login" ? "login" : "trader";
}

// async function fetchDegiroData() {
//   // TODO: handle possible errors while fetching

//   const configResponse = await fetch(CONFIG_URL);
//   const configJSON = await configResponse.json();
//   const config: DegiroConfig = configJSON["data"];

//   const clientUrl = `${config.paUrl}client?sessionId=${config.sessionId}`;
//   const clientResponse = await fetch(clientUrl);
//   const clientJSON = await clientResponse.json();
//   const client: DegiroClient = clientJSON["data"];

//   degiroData = { config, client };
// }

function cleanup() {
  applyTheme("default");
  browser.runtime.onMessage.removeListener(onMessageHandler);
  connectionPort.onDisconnect.removeListener(cleanup);
}

function handleSettingsUpdate(settings: Settings) {
  applyTheme(settings.theme);
}

async function onMessageHandler(
  message: any,
  sender: Runtime.MessageSender
): Promise<any> {
  // Only handle messages that come from the extension itself (if theres `tab` then it comes from a content script)
  if (!sender.tab) {
    switch (message.op) {
      case "settingsUpdate":
        handleSettingsUpdate(message.settings);
        break;
      case "reload":
        location.reload();
        break;
      case "hasBaseTheme":
        return hasBaseTheme;
      case "baseThemeLoaded":
        hasBaseTheme[message.module as Module] = true;
        break;
      case "baseThemeUnloaded":
        hasBaseTheme[message.module as Module] = false;
        break;
    }
  }
}

function colorSchemeChangeHandler(event: MediaQueryListEvent) {
  if (currentTheme === "auto") {
    applyAutoTheme(event.matches);
  }
}

async function loadBaseTheme() {
  await browser.runtime.sendMessage({
    op: "loadBaseTheme",
    module: currentModule,
  });

  hasBaseTheme[currentModule] = true;
}

async function unloadBaseTheme() {
  await browser.runtime.sendMessage({
    op: "unloadBaseTheme",
    module: currentModule,
  });

  hasBaseTheme[currentModule] = false;
}

function applyTheme(theme: string) {
  if (!theme) {
    theme = "default";
  }

  if (theme === "auto") {
    if (currentTheme !== "auto") {
      // Determine which theme we should use
      const useDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyAutoTheme(useDark);
    }
  } else {
    document.querySelector("html")!.dataset.suiteTheme = theme;

    if (theme === "default") {
      unloadBaseTheme();
    } else {
      loadBaseTheme();
      if (theme === "random") {
        applyRandomTheme();
      } else if (currentTheme === "random") {
        removeRandomTheme();
      }
    }
  }

  currentTheme = theme;
}

function applyAutoTheme(useDark = false) {
  document.querySelector("html")!.dataset.suiteTheme = useDark
    ? "dark"
    : "default";
  if (useDark) {
    loadBaseTheme();
  } else {
    unloadBaseTheme();
  }
}

function applyRandomTheme() {
  const style = document.querySelector("html")!.style;
  style.setProperty("--suite-theme-bg-app", getRandomColor());
  style.setProperty("--suite-theme-bg-prominent", getRandomColor());
  style.setProperty("--suite-theme-bg", getRandomColor());
  style.setProperty("--suite-theme-bg-midlite", getRandomColor());
  style.setProperty("--suite-theme-bg-lite", getRandomColor());
  style.setProperty("--suite-theme-color", getRandomColor());
  style.setProperty("--suite-theme-color-secondary", getRandomColor());
  style.setProperty("--suite-theme-border-color", getRandomColor());
  style.setProperty("--suite-theme-scroll-bg", getRandomColor());
  style.setProperty("--suite-theme-scroll-thumb-bg", getRandomColor());
  style.setProperty("--suite-theme-scroll-track-bg", getRandomColor());
  style.setProperty("--suite-theme-red-color", getRandomColor());
  style.setProperty("--suite-theme-green-color", getRandomColor());
  style.setProperty("--suite-theme-textonred-color", getRandomColor());
  style.setProperty("--suite-theme-textongreen-color", getRandomColor());
  style.setProperty("--suite-theme-brightness", getRandomColor());
  style.setProperty("--suite-theme-global-contrast", getRandomColor());
  style.setProperty("--suite-theme-global-saturate", getRandomColor());
  style.setProperty("--suite-theme-chart-line-color", getRandomColor());
}

function removeRandomTheme() {
  const style = document.querySelector("html")!.style;
  style.removeProperty("--suite-theme-bg-app");
  style.removeProperty("--suite-theme-bg-prominent");
  style.removeProperty("--suite-theme-bg");
  style.removeProperty("--suite-theme-bg-midlite");
  style.removeProperty("--suite-theme-bg-lite");
  style.removeProperty("--suite-theme-color");
  style.removeProperty("--suite-theme-color-secondary");
  style.removeProperty("--suite-theme-border-color");
  style.removeProperty("--suite-theme-scroll-bg");
  style.removeProperty("--suite-theme-scroll-thumb-bg");
  style.removeProperty("--suite-theme-scroll-track-bg");
  style.removeProperty("--suite-theme-red-color");
  style.removeProperty("--suite-theme-green-color");
  style.removeProperty("--suite-theme-textonred-color");
  style.removeProperty("--suite-theme-textongreen-color");
  style.removeProperty("--suite-theme-brightness");
  style.removeProperty("--suite-theme-global-contrast");
  style.removeProperty("--suite-theme-global-saturate");
  style.removeProperty("--suite-theme-chart-line-color");
}

initialize();
