interface Options {
    locale?: string;
}

let options: Options = {};

//
// Define and install chrome.webRequest listeners.
//
function onBeforeRequestListener(details: chrome.webRequest.WebRequestDetails) {
    if (options.locale && (options.locale !== 'default')) {
        const match = details.url.match(new RegExp('^(https?://trader.degiro.nl/i18n/messages_)(.+)'));

        if (match !== null && Array.isArray(match)) {
            const [, urlPrefix, requestedLocale] = match;
            console.log(details, { requestedLocale, locale: options.locale });

            if (requestedLocale !== options.locale) {
                let redirect: chrome.webRequest.BlockingResponse = {
                    redirectUrl: urlPrefix + options.locale
                };
                return redirect;
            }

        }
    }
};

function onErrorOccurredListener(details: chrome.webRequest.WebResponseErrorDetails) {
    console.log('onErrorOccurredListener', { details });
};

chrome.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, { urls: ["<all_urls>"] });
chrome.webRequest.onBeforeRequest.addListener(onBeforeRequestListener, { urls: ["<all_urls>"] }, [
    // options: blocking, requestBody
    "blocking",
]);

let onStartupOrOnInstalledListener = function () {
    loadOptions();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log({ message, sender });

        if (message === 'reload') {
            loadOptions(() => {
                chrome.tabs.executeScript({ code: 'window.location.reload();' });
            })
        }

        sendResponse();
    });
};

function loadOptions(callback?: (o?: Options) => any) {
    console.log('Loading options...');
    chrome.storage.sync.get({
        locale: 'default'
    }, function (items) {
        options = items;
        console.log(options);

        if (callback) {
            callback(options);
        }
    });
}

// happens on browser start
chrome.runtime.onStartup.addListener(function () {
    onStartupOrOnInstalledListener();
});

// happens on Reload of extension
chrome.runtime.onInstalled.addListener(function () {
    onStartupOrOnInstalledListener();
});
