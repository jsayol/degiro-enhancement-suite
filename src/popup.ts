// Saves options to chrome.storage
function saveOptions() {
    const localeElement = document.getElementById('locale') as HTMLSelectElement;
    const locale = localeElement.value;
    const newOptions = {
        locale
    };

    chrome.storage.sync.set(newOptions, () => {
        console.log(newOptions);
        chrome.runtime.sendMessage('reload', () => {
            window.close();
        });
    });
}

// Restores options using the preferences stored in chrome.storage.
function getFormOptions() {
    // Use default value locale = 'default'
    chrome.storage.sync.get({
        locale: 'default'
    }, function (items) {
        const localeElement = document.getElementById('locale') as HTMLSelectElement;
        localeElement.value = items.locale;
    });
}

function quickOrderOpen() {
    // const settings = document.getElementById('settings');
    // const quickOrder = document.getElementById('quickOrder');
    const quickOrderIframe = document.getElementById('quickOrder-iframe') as HTMLIFrameElement;

    document.body.classList.remove('showSettings');

    // if (settings !== null) {
    //     settings.style.display = 'none'
    // }

    // if (quickOrder !== null) {
    //     quickOrder.style.display = 'block'
    // }

    if (quickOrderIframe !== null) {
        quickOrderIframe.src = 'https://trader.degiro.nl/trader/?orderMode#/markets?newOrder';
    }
}

function quickOrderClose() {
    // const settings = document.getElementById('settings');
    // const quickOrder = document.getElementById('quickOrder');
    const quickOrderIframe = document.getElementById('quickOrder-iframe') as HTMLIFrameElement;

    document.body.classList.add('showSettings');

    // if (settings !== null) {
    //     settings.style.display = 'none'
    // }

    // if (quickOrder !== null) {
    //     quickOrder.style.display = 'block'
    // }

    if (quickOrderIframe !== null) {
        quickOrderIframe.src = '';
    }
}

document.addEventListener('DOMContentLoaded', getFormOptions);

const saveButton = document.getElementById('save');
saveButton && saveButton.addEventListener('click', saveOptions);

const quickOrderOpenElem = document.getElementById('quickOrder-open');
quickOrderOpenElem && quickOrderOpenElem.addEventListener('click', quickOrderOpen);

const quickOrderCloseElem = document.getElementById('quickOrder-close');
quickOrderCloseElem && quickOrderCloseElem.addEventListener('click', quickOrderClose);
