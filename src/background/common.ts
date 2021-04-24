import { browser, Runtime } from "webextension-polyfill-ts";

const isTabReady: { [tabId: number]: boolean } = {};

export function setTabReady(tabId: number) {
  console.log(`setTabReady(${tabId})`);
  isTabReady[tabId] = true;
}

export function removeTabReady(tabId: number) {
  console.log(`removeTabReady(${tabId})`);
  delete isTabReady[tabId];
}

export function tabIsReady(tabId: number): Promise<void> {
  console.log(`isTabReady[${tabId}] = ${isTabReady[tabId]}`);
  if (isTabReady[tabId]) {
    return Promise.resolve();
  }

  // TODO: maybe add a timeout so that we're not waiting indefinitely
  return new Promise((resolve) => {
    const listener = async (message: any, sender: Runtime.MessageSender) => {
      if (sender.tab && sender.tab.id === tabId && message.op === "tabReady") {
        console.log(`isTabReady[${tabId}] = listener ${isTabReady[tabId]}`);
        resolve();
        browser.runtime.onMessage.removeListener(listener);
      }
    };
    browser.runtime.onMessage.addListener(listener);
  });
}
