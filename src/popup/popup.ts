import { browser, Runtime } from "webextension-polyfill-ts";
import { Settings } from "../common";

async function reloadOpenTabs() {
  const tabs = await browser.tabs.query({ url: "*://trader.degiro.nl/*" });
  tabs.forEach((tab) => {
    if (tab && tab.id) {
      browser.tabs.reload(tab.id);
    }
  });
}

async function saveSetting(name: string, value: any) {
  await browser.runtime.sendMessage({ op: "saveSetting", name, value });
}

// Restores stored settings
async function loadSettings() {
  const settings: Settings = await browser.runtime.sendMessage({
    op: "getSettings",
  });
  const localeElement = document.getElementById("locale") as HTMLSelectElement;
  const themeElement = document.querySelector(
    "#theme-" + settings.theme
  ) as HTMLInputElement | null;

  localeElement.value = settings.locale;
  if (themeElement) {
    themeElement.checked = true;
  }

  applyThemeToPopup(settings.theme);
}

function applyThemeToPopup(theme: string) {
  const data = document.querySelector("html").dataset;
  if (!theme || theme === "default") {
    delete data.suiteTheme;
  } else {
    data.suiteTheme = theme;
  }
}

document.addEventListener("DOMContentLoaded", loadSettings);

document
  .querySelectorAll('input[type="radio"][name="theme"]:not([disabled])')
  .forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const theme = (event.target as HTMLInputElement).value;
      saveSetting("theme", theme);
      applyThemeToPopup(theme);
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
