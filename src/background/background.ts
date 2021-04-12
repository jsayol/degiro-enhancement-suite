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
let knownTabs: Set<number /*tabId*/> = new Set();

function getSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve(items as Settings);
    });
  });
}

function saveSettingItem(name: string, value: any): Promise<void> {
  return new Promise<void>((resolve) => {
    if (name in settings && settings[name as keyof Settings] !== value) {
      settings[name as keyof Settings] = value;
      chrome.storage.sync.set({ [name]: value }, () => {
        propagateSettingsUpdate(settings);
        resolve();
      });
    } else {
      resolve();
    }
  });
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

// Remove the "x-frame-options" response header so we can show the quick order page inside an iframe
function onHeadersReceivedListener(
  details: chrome.webRequest.WebResponseHeadersDetails
): chrome.webRequest.BlockingResponse | void {
  if (details.responseHeaders) {
    const responseHeaders = details.responseHeaders.filter(
      (header) => header.name.toLowerCase() !== "x-frame-options"
    );
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
  ["blocking"]
);
chrome.webRequest.onHeadersReceived.addListener(
  onHeadersReceivedListener,
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);

async function onStartupOrOnInstalledListener() {
  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id) {
      knownTabs.add(tab.id);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId, info) => {
    knownTabs.delete(tabId);
  });

  /**
   * This loops through any open DEGIRO tab to inject the
   * content script when the extension is installed or updated.
   * New tabs created after the extension has been installed will
   * get the script automatically, no need to inject it here.
   */
  chrome.tabs.query({ url: "*://trader.degiro.nl/*" }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab && tab.id && !knownTabs.has(tab.id)) {
        knownTabs.add(tab.id);
        chrome.tabs.executeScript(
          tab.id,
          {
            file: "content/content.js",
          },
          () => {
            /**
             * When the script has executed we open a connection to the
             * tab's content script so that it can detect if the extension
             * gets uninstalled or upgraded.
             */
            chrome.tabs.connect(tab.id!);
          }
        );
      }
    });
  });

  settings = await getSettings();
  propagateSettingsUpdate(settings);

  chrome.runtime.onMessage.addListener(
    async (message, sender, sendResponse) => {
      if ('__parcel_hmr_reload__' in message) {
        /**
         * From: https://v2.parceljs.org/recipes/web-extension/#unexpected-messages
         * `In development mode, your background scripts will receive a message event
         * with the content { __parcel_hmr_reload__: true } whenever the page is reloaded.
         * Parcel will use this automatically to refresh the extension when necessary,
         * so you'll want to ensure any messages your background scripts receive do not
         * have the __parcel_hmr_reload__ property before handling them.`
         */
        return;
      }

      if ("op" in message) {
        switch (message.op) {
          case "saveSetting":
            const { name, value } = message;
            await saveSettingItem(name, value);
            break;
          case "getSettings":
            sendResponse(settings);
            break;
        }
      }
    }
  );
}

/**
 * Fired when a profile that has this extension installed first starts up.
 * This event is not fired when an incognito profile is started, even if
 * this extension is operating in 'split' incognito mode.
 **/
chrome.runtime.onStartup.addListener(onStartupOrOnInstalledListener);

// Fired when the extension is first installed, when the extension is updated to a new version, and when Chrome is updated to a new version.
chrome.runtime.onInstalled.addListener(onStartupOrOnInstalledListener);

function propagateSettingsUpdate(settings: Settings) {
  chrome.runtime.sendMessage({ op: "settingsUpdate", settings });
  chrome.tabs.query({ url: "*://trader.degiro.nl/*" }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { op: "settingsUpdate", settings });
      }
    });
  });
}
