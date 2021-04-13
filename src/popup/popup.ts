import { Settings } from "../common";

function reloadOpenTabs() {
  chrome.tabs.query({ url: "*://trader.degiro.nl/*" }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab && tab.id) {
        chrome.tabs.reload(tab.id);
      }
    });
  });
}

function saveSetting(name: string, value: any) {
  chrome.runtime.sendMessage({ op: "saveSetting", name, value });
}

// Restores stored settings
function loadSettings() {
  chrome.runtime.sendMessage({ op: "getSettings" }, (settings: Settings) => {
    const localeElement = document.getElementById(
      "locale"
    ) as HTMLSelectElement;
    const themeElement = document.querySelector(
      "#theme-" + settings.theme
    ) as HTMLInputElement | null;

    localeElement.value = settings.locale;
    if (themeElement) {
      themeElement.checked = true;
    }

    applyPopupTheme(settings.theme);
  });
}

function applyPopupTheme(theme: string) {
  if (!theme || theme === "default") {
    delete document.body.dataset.enhancementSuitTheme;
  } else {
    document.body.dataset.enhancementSuitTheme = theme;
  }
}

document.addEventListener("DOMContentLoaded", loadSettings);

document
  .querySelectorAll('input[type="radio"][name="theme"]:not([disabled])')
  .forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const theme = (event.target as HTMLInputElement).value;
      saveSetting("theme", theme);
      applyPopupTheme(theme);
    });
  });

(document.querySelector("#locale") as HTMLSelectElement).addEventListener(
  "change",
  (event) => {
    saveSetting("locale", (event.target as HTMLSelectElement).value);
    (document.querySelector(
      "#reloadButton"
    ) as HTMLButtonElement).style.display = "block";
  }
);

(document.querySelector("#tab2") as HTMLInputElement).addEventListener(
  "change",
  (event) => {
    const selected = (event.target as HTMLInputElement).value === "on";

    if (selected) {
      const iframe = document.querySelector(
        "iframe#quickOrder"
      ) as HTMLIFrameElement;

      if (!iframe.hasAttribute("src")) {
        iframe.setAttribute(
          "src",
          "https://trader.degiro.nl/trader/?orderMode#/markets?newOrder"
        );

        // When it loads, notify the frame that it's supposed to show
        // the order mode page (in case the user has to log in)
        iframe.addEventListener(
          "load",
          () => {
            iframe.contentWindow?.postMessage("orderModeFrame", "*");
          },
          false
        );
      }
    }
  }
);

(document.querySelector("#reloadButton") as HTMLButtonElement).addEventListener(
  "click",
  (event) => {
    reloadOpenTabs();
    (event.target as HTMLButtonElement).style.display = "none";
  }
);
