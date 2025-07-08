console.log("Settings script loaded");  // Log when the background script is loaded

document.addEventListener('DOMContentLoaded', function () {
    const currentValuesContainer = document.getElementById('currentValuesContainer');
    const currentTicketURL = document.getElementById('currentTicketURL');
    const currentOpenFoldersAutoSync = document.getElementById('currentOpenFoldersAutoSync');
    const currentAutoSyncTime = document.getElementById('currentAutoSyncTime');

    const formContainer = document.getElementById('formContainer');
    const ticketURLInput = document.getElementById('ticketURL');
    const openFoldersAutoSyncSelect = document.getElementById('openFoldersAutoSync');
    const autoSyncTimeSelect = document.getElementById('autoSyncTime');

    checkCurrentValues();
    // Check if there are stored settings when the page loads
    function checkCurrentValues() {
        browser.storage.local.get(['ticketURL', 'openFoldersAutoSync', 'autoSyncTime']).then((result) => {
            if (result.ticketURL || result.openFoldersAutoSync || result.autoSyncTime) {
                showCurrentValuesContainer(result.ticketURL, result.openFoldersAutoSync, result.autoSyncTime);
            } else {
                showFormContainer();
            }
        });
    }
    // Function to show the current values container and hide the form container
    function showCurrentValuesContainer(ticketURL, openFoldersAutoSync, autoSyncTime) {
        currentTicketURL.textContent = ticketURL;
        currentOpenFoldersAutoSync.textContent = openFoldersAutoSync;
        currentAutoSyncTime.textContent = autoSyncTime;
        currentValuesContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
    }
    // Function to show the form container and hide the current values container
    function showFormContainer() {
        currentValuesContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        ticketURLInput.value = '';
        openFoldersAutoSyncSelect.value = 'true';
        autoSyncTimeSelect.value = '5';
    }
    // Save the new settings and update the UI
    document.getElementById('saveButton').addEventListener('click', function () {
        const ticketURL = ticketURLInput.value;
        const openFoldersAutoSync = openFoldersAutoSyncSelect.value;
        const autoSyncTime = autoSyncTimeSelect.value;

        browser.storage.local.set({
            ticketURL: ticketURL,
            openFoldersAutoSync: openFoldersAutoSync,
            autoSyncTime: autoSyncTime
        }).then(() => {
            console.log('Settings saved:', { ticketURL, openFoldersAutoSync, autoSyncTime });
            showCurrentValuesContainer(ticketURL, openFoldersAutoSync, autoSyncTime);
        }).catch(err => {
            console.error('Error saving settings:', err);
        });
    });

    // Close the window on cancel
    document.getElementById('cancelButton').addEventListener('click', function () {
        window.close();
    });

    // Reset the settings and update the UI
    document.getElementById('resetButton').addEventListener('click', function () {
        browser.storage.local.remove(['ticketURL', 'openFoldersAutoSync', 'autoSyncTime']).then(() => {
            console.log('Settings reset');
            showFormContainer();
        }).catch(err => {
            console.error('Error resetting settings:', err);
        });
    });
});
