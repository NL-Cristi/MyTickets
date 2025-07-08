import { logger } from './logger.js';

const LOG_CONTEXT = "popup.js";
logger.info(LOG_CONTEXT, "Script loaded");

function getAllSettings() {
    return browser.storage.local.get('tickets-settings');
}

async function sendMessageWithFeedback(action, params = {}, successMessage) {
    const context = `sendMessage -> ${action}`;
    try {
        const response = await browser.runtime.sendMessage({ action, ...params });
        if (response.error) {
            throw new Error(response.error);
        }
        logger.info(context, "Success:", response);
        if (successMessage) {
            window.alert(successMessage(response));
        }
        return response;
    } catch (error) {
        logger.error(context, "Error:", error);
        window.alert(error.message);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // Show/hide buttons based on whether settings are configured
    getAllSettings().then(data => {
        const settings = data['tickets-settings'];
        if (settings && Object.values(settings).some(setting => setting)) {
            document.getElementById('openTicketURLButton').hidden = false;
            document.getElementById('create-folder-show-dialog').hidden = false;
            document.getElementById('syncFolderButton').hidden = false;
            document.getElementById('syncAllFoldersButton').hidden = false;
            document.getElementById('closeCaseFolderButton').hidden = false;
            document.getElementById('restoreArchiveButton').hidden = false;
        }
    }).catch(error => {
        logger.error(LOG_CONTEXT, "Error accessing storage: ", error);
    });

    document.getElementById('settingsButton').addEventListener('click', () => {
        browser.windows.create({ url: "settings.html", type: "popup", width: 400, height: 400 });
    });

    document.getElementById('closeCaseFolderButton').addEventListener('click', () => {
        sendMessageWithFeedback('closeCaseFolder', {}, res => `${res.folderName} archived successfully.`);
    });

    document.getElementById('syncFolderButton').addEventListener('click', () => {
        sendMessageWithFeedback('syncFolderMails', {}, res => `Moved ${res.messagesCount} mail(s) to the folder.`);
    });

    document.getElementById('syncAllFoldersButton').addEventListener('click', () => {
        sendMessageWithFeedback('syncAllFolders', {}, res => `Synced ${res.messagesCount} mail(s) across all folders.`);
    });

    document.getElementById('openTicketURLButton').addEventListener('click', async () => {
        const settingsData = await getAllSettings();
        const settings = settingsData['tickets-settings'];
        if (!settings || !settings.ticketURL) {
            window.alert("Ticket URL is not set. Please set it in the settings.");
            return;
        }
        sendMessageWithFeedback('openTicketURL');
    });

    document.getElementById('restoreArchiveButton').addEventListener('click', () => {
        sendMessageWithFeedback('restoreArchivedFolder', {}, res => `${res.folderName} restored successfully.`);
    });

    // Dialog handling for creating a new case folder
    const showBtn = document.getElementById("create-folder-show-dialog");
    const dialog = document.getElementById("folder-dialog");
    const saveBtn = dialog.querySelector("#save");
    const cancelBtn = dialog.querySelector("#cancel");
    const folderInput = document.getElementById("folder-input");

    showBtn.addEventListener("click", () => dialog.showModal());
    cancelBtn.addEventListener("click", () => dialog.close());

    saveBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const newFolderName = folderInput.value.trim();
        if (!newFolderName) {
            dialog.close();
            return;
        }

        try {
            const settingsData = await getAllSettings();
            const settings = settingsData['tickets-settings'];
            if (!settings || !settings.openedFolder) {
                throw new Error("Opened folder path not configured in settings.");
            }

            const { caseID } = await browser.runtime.sendMessage({ action: "getCaseID" });
            
            let finalFolderName = newFolderName;
            if (caseID) {
                finalFolderName = `${caseID} - ${newFolderName}`;
            } else {
                logger.warn(LOG_CONTEXT, "Could not get Ticket ID from subject. Creating folder without it.");
                window.alert("Could not get Ticket ID from subject. Creating folder without it.");
            }

            const folderPath = `${settings.openedFolder}/${finalFolderName}`;
            await sendMessageWithFeedback('createCaseFolder', { folderPath }, () => `Folder "${finalFolderName}" created successfully.`);
        
        } catch(error) {
            logger.error(LOG_CONTEXT, "Error creating folder:", error);
            window.alert("Error creating folder: " + error.message);
        } finally {
            dialog.close();
            folderInput.value = ''; // Reset input
        }
    });
});
