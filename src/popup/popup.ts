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

document.querySelector("#locale").addEventListener("change", (event) => {
  saveSetting("locale", (event.target as HTMLSelectElement).value);
  (document.querySelector("#reloadButton") as HTMLButtonElement).style.display =
    "block";
});

(document.querySelector("#tab-order") as HTMLInputElement).addEventListener(
  "selectionchange",
  (event) => {
    const selected = (event.target as HTMLInputElement).value === "on";
    console.log({ selected });

    if (selected) {
      // Hide the donations buttons
      (document.querySelector(".bottom") as HTMLDivElement).style.display =
        "none";

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
    } else {
      // Show the donations buttons
      (document.querySelector(".bottom") as HTMLDivElement).style.display =
        "block";
    }
  }
);

document.querySelector("#reloadButton").addEventListener("click", (event) => {
  reloadOpenTabs();
  (event.target as HTMLButtonElement).style.display = "none";
});

const fxAmountElement = document.querySelector("#fx-amount");
["keyup", "keydown", "change"].forEach((action) => {
  fxAmountElement.addEventListener(action, fxCalculateFee);
});

document
  .querySelector("#fx-currency")
  .addEventListener("change", fxCalculateFee);

const currencyMap = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr",
  DKK: "Kr",
  NOK: "Kr",
  SEK: "Kr",
};

function fxCalculateFee() {
  const amountElement: HTMLInputElement = document.querySelector("#fx-amount");
  const currencyElement: HTMLSelectElement = document.querySelector(
    "#fx-currency"
  );

  const amount = Number(amountElement.value);
  const currency = currencyElement.value;

  const feeAutofx = Math.round(100 * (amount * 0.001)) / 100;
  const feeManual = Math.round(100 * (amount * 0.0002)) / 100;
  const feeAutofxElement = document.querySelector("#fx-fee-autofx");
  const feeManualElement = document.querySelector("#fx-fee-manual");
  const currBefore = ["USD", "GBP"].includes(currency);
  const currSymbol = currencyMap[currency];

  let feeAutofxDisplay = "";
  let feeManualDisplay = "";

  // TODO: this is a mess, clean it up
  if (amount > 0) {
    feeAutofxDisplay = `${currBefore ? currSymbol : ""}<b>${String(
      feeAutofx
    )}</b>${!currBefore ? currSymbol : ""}`;
    if (currency === "EUR") {
      feeManualDisplay = `${currBefore ? currSymbol : ""}<b>${String(
        Math.round(100 * (10 + feeManual)) / 100
      )}</b>${!currBefore ? currSymbol : ""}`;
    } else {
      feeManualDisplay = `<b>10</b>€ + ${
        currBefore ? currSymbol : ""
      }<b>${String(feeManual)}</b>${!currBefore ? currSymbol : ""}`;
    }
  }

  feeAutofxElement.innerHTML = feeAutofxDisplay;
  feeManualElement.innerHTML = feeManualDisplay;
}

document.querySelectorAll(".foldable-trigger").forEach((trigger) => {
  trigger.addEventListener("click", (event) => {
    const content = trigger.parentElement.querySelector(".foldable-content");
    if (content) {
      content.classList.toggle("open");
    }
    trigger.classList.toggle("open");
  });
});
