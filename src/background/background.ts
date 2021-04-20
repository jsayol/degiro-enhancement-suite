import { browser, WebRequest } from "webextension-polyfill-ts";
import { Settings } from "../common";
import * as stylesManager from "./styles-manager";

const DEFAULT_SETTINGS: Settings = {
  locale: "default",
  theme: "default",
};

let settings = DEFAULT_SETTINGS;
let knownTabs: Set<number /*tabId*/> = new Set();

function getSettings(): Promise<Settings> {
  return browser.storage.sync.get(DEFAULT_SETTINGS) as Promise<Settings>;
}

async function saveSettingItem(name: string, value: any): Promise<void> {
  try {
    if (name in settings && settings[name as keyof Settings] !== value) {
      settings[name as keyof Settings] = value;
      await browser.storage.sync.set({ [name]: value });
      propagateSettingsUpdate(settings);
    }
  } catch (err) {
    console.error(err);
  }
}

// Intercept the request for the I18N file and replace it with the user's preferred language
function onBeforeRequestListener(
  details: WebRequest.OnBeforeRequestDetailsType
): WebRequest.BlockingResponse | void {
  // Fetch and parse sourcemaps for js files
  if (details.url.match(stylesManager.JS_URL_REGEX)) {
    /**
     * TODO: unlikely, but just appending ".map" might not necessarily
     * be the url of the source map. Maybe extract it from the js?
     * (fetch() with "Range: bytes=-800" header)
     **/
    stylesManager.applySourceMap(details.url + ".map");
  }

  // TODO: temp, extracts a list of the CSS files loaded so far
  if (details.url.includes(".css")) {
    console.log(details.url);
  }

  if (settings.locale && settings.locale !== "default") {
    // Replace the default i18n file with the one chosen by the user
    const match = details.url.match(
      new RegExp("^(https?://trader.degiro.nl/i18n/messages_)(.+)")
    );

    if (match !== null && Array.isArray(match)) {
      const [, urlPrefix, requestedLocale] = match;

      if (requestedLocale !== settings.locale) {
        const redirect: WebRequest.BlockingResponse = {
          redirectUrl: urlPrefix + settings.locale,
        };
        return redirect;
      }
    }
  }
}

function onHeadersReceivedListener(
  details: WebRequest.OnHeadersReceivedDetailsType
): WebRequest.BlockingResponse | void {
  /**
   * Remove the "x-frame-options" response header so that we can show
   * the quick order page inside an iframe.
   **/
  if (details.responseHeaders) {
    const responseHeaders = details.responseHeaders.filter(
      (header) => header.name.toLowerCase() !== "x-frame-options"
    );
    return { responseHeaders };
  }
}

function onErrorOccurredListener(
  details: WebRequest.OnErrorOccurredDetailsType
) {
  console.log("onErrorOccurredListener", details);
}

browser.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, {
  urls: ["<all_urls>"],
});

browser.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener,
  { urls: ["<all_urls>"] },
  ["blocking"]
);
browser.webRequest.onHeadersReceived.addListener(
  onHeadersReceivedListener,
  { urls: ["<all_urls>"] },
  ["blocking", "responseHeaders"]
);

async function onStartupOrOnInstalledListener() {
  try {
    // Flush in-memory cache so that we can see all requests
    // See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/handlerBehaviorChanged
    const flushingCache = browser.webRequest.handlerBehaviorChanged();

    // Keep track of open tabs
    browser.tabs.onCreated.addListener((tab) => {
      if (tab.id) {
        knownTabs.add(tab.id);
      }
    });
    browser.tabs.onRemoved.addListener((tabId, info) => {
      knownTabs.delete(tabId);
    });

    /**
     * This loops through any open DEGIRO tab to inject the
     * content script when the extension is installed or updated.
     * New tabs created after the extension has been installed will
     * get the script automatically, no need to inject it here.
     */
    const tabs = await browser.tabs.query({ url: "*://trader.degiro.nl/*" });
    tabs.forEach(async (tab) => {
      try {
        if (tab && tab.id && !knownTabs.has(tab.id)) {
          knownTabs.add(tab.id);
          await browser.tabs.executeScript(tab.id, {
            file: "content/content.js",
          });
          /**
           * When the script has executed we open a connection to the
           * tab's content script so that it can detect if the extension
           * gets uninstalled or upgraded.
           */
          browser.tabs.connect(tab.id!);
        }
      } catch (err) {
        console.error(err);
      }
    });

    settings = await getSettings();
    propagateSettingsUpdate(settings);

    // Handle messages
    browser.runtime.onMessage.addListener(async (message, sender) => {
      try {
        if ("__parcel_hmr_reload__" in message) {
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
            case "activateIcon":
              if (browser.pageAction) {
                browser.pageAction.show(sender.tab.id);
              }
              break;
            case "saveSetting":
              const { name, value } = message;
              await saveSettingItem(name, value);
              break;
            case "getSettings":
              return settings;
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    await flushingCache;
  } catch (err) {
    console.error(err);
  }
}

/**
 * Fired when a profile that has this extension installed first starts up.
 * This event is not fired when an incognito profile is started, even if
 * this extension is operating in 'split' incognito mode.
 **/
browser.runtime.onStartup.addListener(onStartupOrOnInstalledListener);

/**
 * Fired when the extension is first installed, when the extension is updated
 * to a new version, and when Chrome is updated to a new version.
 **/
browser.runtime.onInstalled.addListener(onStartupOrOnInstalledListener);

async function propagateSettingsUpdate(settings: Settings) {
  try {
    const tabs = await browser.tabs.query({ url: "*://trader.degiro.nl/*" });
    tabs.forEach(async (tab) => {
      try {
        if (tab && tab.id) {
          await browser.tabs.sendMessage(tab.id, {
            op: "settingsUpdate",
            settings,
          });
        }
      } catch (err) {
        console.error(err);
      }
    });
  } catch (err) {
    console.error(err);
  }
}
