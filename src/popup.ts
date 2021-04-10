interface Settings {
  locale: string;
  theme: string;
}

// Saves options to chrome.storage
function saveOptions() {
  const localeElement = document.getElementById("locale") as HTMLSelectElement;

  const locale = localeElement.value;
  const newOptions = {
    locale,
  };

  chrome.storage.sync.set(newOptions, () => {
    console.log(newOptions);
    chrome.runtime.sendMessage("reload", () => {
      window.close();
    });
  });
}

function saveSetting(name: string, value: any) {
  chrome.runtime.sendMessage({ op: "saveSetting", name, value }, () => {
    // window.close();
  });
}

// Restores stored settings
function loadSettings() {
  console.log("Loading settings...");
  chrome.runtime.sendMessage({ op: "getSettings" }, (settings: Settings) => {
    console.log(settings);
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
  });
}

function quickOrderOpen() {
  const quickOrderIframe = document.getElementById(
    "quickOrder-iframe"
  ) as HTMLIFrameElement;

  document.body.classList.remove("showSettings");

  if (quickOrderIframe !== null) {
    quickOrderIframe.src =
      "https://trader.degiro.nl/trader/?orderMode#/markets?newOrder";
  }
}

function quickOrderClose() {
  const quickOrderIframe = document.getElementById(
    "quickOrder-iframe"
  ) as HTMLIFrameElement;

  document.body.classList.add("showSettings");

  if (quickOrderIframe !== null) {
    quickOrderIframe.src = "";
  }
}

document.addEventListener("DOMContentLoaded", loadSettings);

const saveButton = document.getElementById("save");
saveButton && saveButton.addEventListener("click", saveOptions);

const quickOrderOpenElem = document.getElementById("quickOrder-open");
quickOrderOpenElem &&
  quickOrderOpenElem.addEventListener("click", quickOrderOpen);

const quickOrderCloseElem = document.getElementById("quickOrder-close");
quickOrderCloseElem &&
  quickOrderCloseElem.addEventListener("click", quickOrderClose);

document
  .querySelectorAll('input[type="radio"][name="theme"]:not([disabled])')
  .forEach((radio) => {
    radio.addEventListener("change", (event) => {
      const theme = (event.target as HTMLInputElement).value;
      saveSetting("theme", theme);
    });
  });

document.querySelector("#locale")?.addEventListener("change", (event) => {
  saveSetting("locale", (event.target as HTMLSelectElement).value);
});
