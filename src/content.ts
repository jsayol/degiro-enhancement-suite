const CSS_ID_PREFIX = "degiro-enhancement-suite--css-";
const THEME_CLASS_PREFIX = "degiro-enhancement-suite--theme-";
const onColorScheme = window.matchMedia("(prefers-color-scheme: dark)");

let currentTheme = "default";
let isAutoTheme = false;
let connectionPort: chrome.runtime.Port;

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
  if (currentTheme !== "default") {
    loadStyleSheet("css/theme.css", "common");
  }
  chrome.runtime.sendMessage({ op: "getSettings" }, handleSettingsUpdate);
  chrome.runtime.onMessage.addListener(onMessageHandler);
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

function loadStyleSheet(filePath: string, id: string) {
  var link = document.createElement("link");
  link.setAttribute("href", chrome.extension.getURL(filePath));
  link.setAttribute("id", `${CSS_ID_PREFIX}${id}`);
  link.setAttribute("type", "text/css");
  link.setAttribute("rel", "stylesheet");
  document.querySelector("html")?.appendChild(link);
}

function unloadStyleSheet(id: string, isFullId = false) {
  var cssNode = document.querySelector(
    `#${isFullId ? "" : CSS_ID_PREFIX}${id}`
  );
  if (cssNode && cssNode.parentNode) {
    cssNode.parentNode.removeChild(cssNode);
  }
}

function applyCustomTheme(theme: string) {
  if (!theme) {
    theme = "default";
  }

  const wasAutoTheme = isAutoTheme;
  isAutoTheme = theme === "auto";

  if (isAutoTheme) {
    // Determine which theme we should use
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    } else {
      theme = "default";
    }
    if (!wasAutoTheme) {
      startDarkModeDetection();
    }
  } else if (wasAutoTheme) {
    stopDarkModeDetection();
  }

  if (theme === currentTheme) {
    return;
  }

  if (currentTheme === "default") {
    // Load the common CSS styles for a non-default theme
    loadStyleSheet("css/theme.css", "common");
  }

  if (theme !== "default") {
    // Load StyleSheet for the new theme
    loadStyleSheet(`css/themes/${theme}.css`, `theme-${theme}`);
  } else {
    // Unload the common CSS styles for a non-default theme
    unloadStyleSheet("common");
  }

  // Unload any previous theme css files.
  // Note: It's important to do this after loading the new one to avoid
  // any jitter when switching themes. Not critical but looks ugly otherwise.
  document
    .querySelectorAll(
      `link[id^='${CSS_ID_PREFIX}theme-']:not([id='${CSS_ID_PREFIX}theme-${theme}'])`
    )
    .forEach((sheet) => unloadStyleSheet(sheet.id, true));

  currentTheme = theme;
}

function startDarkModeDetection() {
  if (window.matchMedia("(prefers-color-scheme)").media === "not all") {
    // Color scheme detection is not supported
    return;
  }
  onColorScheme.addEventListener("change", colorSchemeChangeHandler);
}

function stopDarkModeDetection() {
  onColorScheme.removeEventListener("change", colorSchemeChangeHandler);
}

function colorSchemeChangeHandler(event: MediaQueryListEvent) {
  applyCustomTheme("auto");
}

if (window.parent !== window) {
  window.addEventListener("message", (event) => {
    if (event.data === "orderModeFrame") {
      const isTraderPage = !!window.location.href.match(/\/trader\/\#/);
      const isOrderModePage = !!window.location.href.match(/\?orderMode/);
      if (isTraderPage && !isOrderModePage) {
        /**
         * We're inside an iframe that requested the "global order mode" but
         * the user had to log in and the app routed to the main page instead.
         * Let's take the user back to the order mode page again.
         */
        window.location.href =
          "https://trader.degiro.nl/trader/?orderMode#/markets?newOrder";
      }
    }
  });
}

// TODO: this is temporary to avoid applying themes to the quick order iframe
if (window.parent === window) {
  initialize();
}
