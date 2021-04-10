// TODO: webpack or similar

interface Settings {
  locale: string;
  theme: string;
}

const DEFAULT_SETTINGS: Settings = {
  locale: "default",
  theme: "default",
};

let settings = DEFAULT_SETTINGS;

function getSettings(callback: (o: Settings) => any) {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    if (callback) {
      callback(settings as Settings);
    }
  });
}

function syncSetting(name: string, value: any, callback?: Function) {
  console.log(name in settings, settings[name as keyof Settings] !== value);
  if (name in settings && settings[name as keyof Settings] !== value) {
    console.log("Syncing", name, value);
    const setting = {
      [name]: value,
    };

    settings[name as keyof Settings] = value;

    chrome.storage.sync.set(setting, () => {
      if (callback) {
        callback();
      }
      // chrome.runtime.sendMessage('reload', () => {
      //     window.close();
      // });

      propagateSettingsUpdate(settings);
    });

    // if (name === "theme") {
    //   applyCustomTheme(value);
    // }
  }
}

// Intercept the request for the I18N file and replace it with the user's preferred language
function onBeforeRequestListener(
  details: chrome.webRequest.WebRequestDetails
): chrome.webRequest.BlockingResponse | void {
  if (settings.locale && settings.locale !== "default") {
    const match = details.url.match(
      new RegExp("^(https?://trader.degiro.nl/i18n/messages_)(.+)")
    );

    if (match !== null && Array.isArray(match)) {
      const [, urlPrefix, requestedLocale] = match;

      if (requestedLocale !== settings.locale) {
        const redirect: chrome.webRequest.BlockingResponse = {
          redirectUrl: urlPrefix + settings.locale,
        };
        return redirect;
      }
    }
  }
}

// Remove the "x-frame-options" response header so we can show the quick order page in an iframe
function onHeadersReceivedListener(
  details: chrome.webRequest.WebResponseHeadersDetails
): chrome.webRequest.BlockingResponse | void {
  if (details.responseHeaders) {
    const responseHeaders = details.responseHeaders.filter(
      (h) => h.name !== "x-frame-options"
    );

    // if (details.responseHeaders.some(h => h.name === "x-frame-options")) {
    //     console.log({ details, responseHeaders });
    // }

    return { responseHeaders };
  }
}

function onErrorOccurredListener(
  details: chrome.webRequest.WebResponseErrorDetails
) {
  console.log("onErrorOccurredListener", details);
}

chrome.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, {
  urls: ["<all_urls>"],
});
chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener,
  { urls: ["<all_urls>"] },
  [
    // options: "blocking", "requestBody"
    "blocking",
  ]
);
chrome.webRequest.onHeadersReceived.addListener(
  onHeadersReceivedListener,
  { urls: ["<all_urls>"] },
  [
    // options: "blocking", "responseHeaders", or "extraHeaders"
    "blocking",
    "responseHeaders",
  ]
);

let onStartupOrOnInstalledListener = function () {
  console.log("onStartupOrOnInstalledListener");
  getSettings((items) => {
    console.log(settings);
    settings = items;
    propagateSettingsUpdate(settings);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log({ message, sender });

    if (message === "reload") {
      chrome.tabs.executeScript({ code: "window.location.reload();" });
      sendResponse();
    } else if ("op" in message) {
      console.log("op in message");
      //   if (message.op === "getSettings") {
      //     getSettings((list) => sendResponse(list));
      //   } else
      if (message.op === "saveSetting") {
        console.log("saveSetting");
        const { name, value } = message;
        syncSetting(name, value, () => sendResponse());
      } else if (message.op === "getSettings") {
        sendResponse(settings);
        // propagateSettingsUpdate(settings);
      }
    } else {
      sendResponse();
    }
  });
};

// happens on browser start
chrome.runtime.onStartup.addListener(function () {
  onStartupOrOnInstalledListener();
});

// happens on Reload of extension
chrome.runtime.onInstalled.addListener(function () {
  onStartupOrOnInstalledListener();
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  //   if (info.status == "complete") enableCustomThemesForTab(tab);
});

// function enableCustomThemesForTab(tab: chrome.tabs.Tab) {
//   var tabUrl = tab.url;
//   if (tabUrl && tabUrl.match("^https?://trader.degiro.nl")) {
//     console.log(`enableCustomThemesForTab(${tab.id})`);
//     chrome.tabs.insertCSS(tab.id as number, { file: "css/theme.css" });
//   }
// }

// function applyCustomTheme(theme: string) {
//   console.log(`applyCustomTheme(${theme})`);
//   chrome.runtime.sendMessage({ op: "applyCustomTheme", theme });
//   //   chrome.tabs.query({ url: "*://trader.degiro.nl/*" }, (tabs) => {
//   //     console.log(tabs);
//   //     // tabs.forEach((tab) => enableCustomThemesForTab(tab));
//   //   });
// }

function propagateSettingsUpdate(settings: Settings) {
  console.log("propagateSettingsUpdate", settings);

  chrome.runtime.sendMessage({ op: "settingsUpdate", settings });

  chrome.tabs.query({ url: "*://trader.degiro.nl/*" }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { op: "settingsUpdate", settings });
      }
    });
  });
}
