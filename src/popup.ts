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

document.addEventListener('DOMContentLoaded', getFormOptions);

const saveButton = document.getElementById('save') as HTMLButtonElement;
saveButton.addEventListener('click', saveOptions);

