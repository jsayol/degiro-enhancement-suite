import { Settings } from "../common";

let connectionPort: chrome.runtime.Port;
let currentTheme = "default";

/**
 * Monitor the connection to the extension's background page.
 * This allows us to detect if it get uninstalled or upgraded
 * so that we can do some cleanup.
 */
chrome.runtime.onConnect.addListener((port) => {
  connectionPort = port;
  connectionPort.onDisconnect.addListener(cleanup);
});

function initialize() {
  chrome.runtime.sendMessage({ op: "getSettings" }, handleSettingsUpdate);
  chrome.runtime.onMessage.addListener(onMessageHandler);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", colorSchemeChangeHandler);

  // If we're inside an iframe (quick order in popup) we mark
  // the page so that we can avoid applying themes for now.
  if (window.self !== window.top) {
    document.querySelector("html").dataset.enhancementSuiteIframe = "true";
  }
}

function cleanup() {
  applyCustomTheme("default");
  chrome.runtime.onMessage.removeListener(onMessageHandler);
  connectionPort.onDisconnect.removeListener(cleanup);
}

function handleSettingsUpdate(settings: Settings) {
  applyCustomTheme(settings.theme);
}

function onMessageHandler(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): void {
  // Only handle messages that come from the extension itself (if theres `tab` then it comes from a content script)
  if (!sender.tab) {
    if (message.op === "settingsUpdate") {
      handleSettingsUpdate(message.settings);
    }
    if (message.op === "reload") {
      location.reload();
    }
  }
}

function applyCustomTheme(theme: string) {
  if (!theme) {
    theme = "default";
  }

  if (theme === "auto") {
    if (currentTheme !== "auto") {
      // Determine which theme we should use
      const useDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.querySelector("html").dataset.enhancementSuiteTheme = useDark
        ? "dark"
        : "default";
    }
  } else {
    document.querySelector("html").dataset.enhancementSuiteTheme = theme;
    delete document.querySelector("html").dataset.enhancementSuiteThemeAuto;
  }

  currentTheme = theme;
}

function colorSchemeChangeHandler(event: MediaQueryListEvent) {
  if (currentTheme === "auto") {
    document.querySelector("html").dataset.enhancementSuiteTheme = event.matches
      ? "dark"
      : "default";
  }
}

initialize();
