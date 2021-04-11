const CSS_ID_PREFIX = "degiro-enhancement-suite--css-";
const THEME_CLASS_PREFIX = "degiro-enhancement-suite--theme-";

let currentTheme = "default";

function initialize() {
  console.log("initialize()");

  if (currentTheme !== "default") {
    loadStyleSheet("css/theme.css", "common");
  }

  chrome.runtime.sendMessage({ op: "getSettings" }, (settings) => {
    console.log("getSettings response", settings);
    applyCustomTheme(settings.theme);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log({ message, sender, sendResponse });

    if (!sender.tab) {
      // Message comes from the extension itself (if theres `tab` then it comes from a content script)

      if (message.op === "settingsUpdate") {
        applyCustomTheme(message.settings.theme);
      }
      if (message.op === "reload") {
        location.reload();
      }
    }
  });
}

function loadStyleSheet(filePath, id) {
  var link = document.createElement("link");
  link.setAttribute("href", chrome.extension.getURL(filePath));
  link.setAttribute("id", `${CSS_ID_PREFIX}${id}`);
  link.setAttribute("type", "text/css");
  link.setAttribute("rel", "stylesheet");
  document.querySelector("html").appendChild(link);
}

function unloadStyleSheet(id, isFullId = false) {
  var cssNode = document.querySelector(
    `#${isFullId ? "" : CSS_ID_PREFIX}${id}`
  );
  if (cssNode) {
    cssNode.parentNode.removeChild(cssNode);
  }
}

function applyCustomTheme(theme) {
  if (!theme) {
    theme = "default";
  }

  console.log(`applyCustomTheme(${theme}) - currentTheme=${currentTheme}`);

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
  setTimeout(() => {
    document
      .querySelectorAll(
        `link[id^='${CSS_ID_PREFIX}theme-']:not([id='${CSS_ID_PREFIX}theme-${theme}'])`
      )
      .forEach((sheet) => unloadStyleSheet(sheet.id, true));
  }, 1000);

  currentTheme = theme;
}

initialize();
