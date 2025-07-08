import { logger } from './logger.js';

const LOG_CONTEXT = "settings.js";
const SETTINGS_KEY = 'tickets-settings';
logger.info(LOG_CONTEXT, "Script loaded");

document.addEventListener('DOMContentLoaded', function () {
    // UI Elements
    const currentValuesContainer = document.getElementById('currentValuesContainer');
    const formContainer = document.getElementById('formContainer');

    // Display elements
    const currentTicketURL = document.getElementById('currentTicketURL');
    const currentOpenedFolder = document.getElementById('currentOpenedFolder');
    const currentClosedFolder = document.getElementById('currentClosedFolder');
    const currentSyncFolders = document.getElementById('currentSyncFolders');
    const currentOpenFoldersAutoSync = document.getElementById('currentOpenFoldersAutoSync');
    const currentAutoSyncTime = document.getElementById('currentAutoSyncTime');
    const currentDebugMode = document.getElementById('currentDebugMode');

    // Folder Status Elements
    const openedFolderOK = document.getElementById('openedFolderOK');
    const createOpenedFolderBtn = document.getElementById('createOpenedFolder');
    const closedFolderOK = document.getElementById('closedFolderOK');
    const createClosedFolderBtn = document.getElementById('createClosedFolder');

    // Form Inputs
    const ticketURLInput = document.getElementById('ticketURL');
    const openedFolderInput = document.getElementById('openedFolder');
    const closedFolderInput = document.getElementById('closedFolder');
    const syncFoldersInput = document.getElementById('syncFolders');
    const openFoldersAutoSyncSelect = document.getElementById('openFoldersAutoSync');
    const autoSyncTimeSelect = document.getElementById('autoSyncTime');
    const debugModeSelect = document.getElementById('debugMode');

    // Action Buttons
    const editButton = document.getElementById('editButton');
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const resetButton = document.getElementById('resetButton');

    let currentSettings = {};

    function checkAndDisplayFolderStatus(folderPath, okSpan, createButton) {
        if (!folderPath) {
            okSpan.classList.add('hidden');
            createButton.classList.add('hidden');
            return;
        }

        browser.runtime.sendMessage({ action: "checkFolderExists", folderPath: folderPath })
            .then(response => {
                if (response.exists) {
                    okSpan.classList.remove('hidden');
                    createButton.classList.add('hidden');
                } else {
                    okSpan.classList.add('hidden');
                    createButton.classList.remove('hidden');
                }
            })
            .catch(err => {
                logger.error(LOG_CONTEXT, `Error checking folder "${folderPath}":`, err);
                okSpan.classList.add('hidden');
                createButton.classList.remove('hidden'); // Show create button on error
            });
    }

    function showCurrentValuesContainer(settings) {
        currentTicketURL.textContent = settings.ticketURL || '';
        currentOpenedFolder.textContent = settings.openedFolder || '';
        currentClosedFolder.textContent = settings.closedFolder || '';
        currentSyncFolders.textContent = settings.syncFolders || '';
        currentOpenFoldersAutoSync.textContent = (settings.openFoldersAutoSync === 'true' || settings.openFoldersAutoSync === true) ? 'Enabled' : 'Disabled';
        currentAutoSyncTime.textContent = settings.autoSyncTime || '';
        currentDebugMode.textContent = (settings.debugMode === true || settings.debugMode === 'true') ? 'Enabled' : 'Disabled';
        
        checkAndDisplayFolderStatus(settings.openedFolder, openedFolderOK, createOpenedFolderBtn);
        checkAndDisplayFolderStatus(settings.closedFolder, closedFolderOK, createClosedFolderBtn);
        
        currentValuesContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
    }

    function showFormContainer(settings = {}) {
        currentValuesContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
        
        ticketURLInput.value = settings.ticketURL || '';
        openedFolderInput.value = settings.openedFolder || '';
        closedFolderInput.value = settings.closedFolder || '';
        syncFoldersInput.value = settings.syncFolders || '';
        openFoldersAutoSyncSelect.value = settings.openFoldersAutoSync?.toString() || 'true';
        autoSyncTimeSelect.value = settings.autoSyncTime || '5';
        debugModeSelect.value = settings.debugMode?.toString() || 'false';
    }

    function setupEventListeners() {
        createOpenedFolderBtn.addEventListener('click', () => {
            const folderPath = currentOpenedFolder.textContent;
            if (folderPath) {
                browser.runtime.sendMessage({ action: "createCaseFolder", folderPath: folderPath }).then(() => {
                    logger.info(LOG_CONTEXT, `Creation requested for "${folderPath}". Re-checking status.`);
                    checkAndDisplayFolderStatus(folderPath, openedFolderOK, createOpenedFolderBtn);
                });
            }
        });

        createClosedFolderBtn.addEventListener('click', () => {
            const folderPath = currentClosedFolder.textContent;
            if (folderPath) {
                browser.runtime.sendMessage({ action: "createCaseFolder", folderPath: folderPath }).then(() => {
                    logger.info(LOG_CONTEXT, `Creation requested for "${folderPath}". Re-checking status.`);
                    checkAndDisplayFolderStatus(folderPath, closedFolderOK, createClosedFolderBtn);
                });
            }
        });
        
        saveButton.addEventListener('click', function () {
            const newSettings = {
                ticketURL: ticketURLInput.value.trim(),
                openedFolder: openedFolderInput.value.trim(),
                closedFolder: closedFolderInput.value.trim(),
                syncFolders: syncFoldersInput.value.trim(),
                openFoldersAutoSync: openFoldersAutoSyncSelect.value,
                autoSyncTime: autoSyncTimeSelect.value,
                debugMode: debugModeSelect.value === 'true',
            };

            browser.storage.local.set({ [SETTINGS_KEY]: newSettings }).then(() => {
                logger.info(LOG_CONTEXT, 'Settings saved:', newSettings);
                currentSettings = newSettings;
                showCurrentValuesContainer(newSettings);
            }).catch(err => {
                logger.error(LOG_CONTEXT, 'Error saving settings:', err);
            });
        });

        cancelButton.addEventListener('click', function () {
            // If there are settings, show them. Otherwise, stay on the form.
            if (currentSettings && Object.keys(currentSettings).length > 0) {
                showCurrentValuesContainer(currentSettings);
            }
        });

        editButton.addEventListener('click', function () {
            showFormContainer(currentSettings);
        });

        resetButton.addEventListener('click', function () {
            browser.storage.local.remove(SETTINGS_KEY).then(() => {
                logger.info(LOG_CONTEXT, 'Settings reset');
                currentSettings = {};
                showFormContainer(); // Show empty form after reset
            }).catch(err => {
                logger.error(LOG_CONTEXT, 'Error resetting settings:', err);
            });
        });
    }

    // Initial Load
    function initialize() {
        browser.storage.local.get(SETTINGS_KEY).then(data => {
            if (data[SETTINGS_KEY] && Object.keys(data[SETTINGS_KEY]).length > 0) {
                currentSettings = data[SETTINGS_KEY];
                showCurrentValuesContainer(currentSettings);
            } else {
                showFormContainer(); // No settings, show empty form
            }
            setupEventListeners();
        }).catch(err => {
            logger.error(LOG_CONTEXT, 'Fatal error loading settings on startup:', err);
            showFormContainer(); // Show form on error
            setupEventListeners();
        });
    }

    initialize();
});
