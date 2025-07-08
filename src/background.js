import { logger } from './logger.js';

const LOG_CONTEXT = "background.js";
logger.info(LOG_CONTEXT, "Script loaded");

// Initial setup of the alarm based on stored settings
setupAlarm();

browser.browserAction.onClicked.addListener(() => {
    logger.debug(LOG_CONTEXT, "Browser action clicked, opening popup.");
    browser.browserAction.setPopup({ popup: "popup.html" });
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, ...params } = message;
    logger.debug(LOG_CONTEXT, `Handling action: ${action}`, params);

    const actions = {
        openGoogle: () => {
            OpenGoogle();
            return Promise.resolve({ success: true });
        },
        createCaseFolder: () => createCaseFolder(params.folderPath),
        checkFolderExists: () => checkFolderExists(params.folderPath),
        syncAllFolders: () => SyncALLFolderMails(),
        closeCaseFolder: () => archiveCaseFolder(),
        syncFolderMails: () => syncFolderMails(),
        restoreArchivedFolder: () => restoreArchivedFolder(),
        openTicketURL: () => OpenTicketURL(),
        getCaseID: () => ReturnTicketCaseID().then(caseID => ({ caseID })),
    };

    if (actions[action]) {
        actions[action]()
            .then(response => sendResponse(response))
            .catch(error => {
                logger.error(`${LOG_CONTEXT} -> ${action}`, "Error:", error);
                sendResponse({ success: false, error: error.message });
            });
    } else {
        logger.warn(LOG_CONTEXT, "Unknown action received:", action);
    }

    return true; // Indicate that the response will be sent asynchronously
});

async function setupAlarm() {
    const context = "setupAlarm";
    try {
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');

        const periodInMinutes = parseInt(settings?.autoSyncTime || '5', 10);
        const openFoldersAutoSync = settings?.openFoldersAutoSync === true || settings?.openFoldersAutoSync === 'true';

        logger.info(context, `Configuring alarm. Period: ${periodInMinutes} mins, AutoSync: ${openFoldersAutoSync}`);

        await browser.alarms.clearAll();

        if (openFoldersAutoSync) {
            browser.alarms.create("syncAlarm", { periodInMinutes: periodInMinutes });
            logger.info(context, `Alarm 'syncAlarm' created with a ${periodInMinutes} minute period.`);
        } else {
            logger.info(context, 'AutoSync is disabled, alarm not created.');
        }

    } catch (error) {
        logger.error(context, "Error setting up alarm:", error);
    }
}

browser.alarms.onAlarm.addListener(async (alarm) => {
    const context = "onAlarm";
    if (alarm.name === "syncAlarm") {
        logger.info(context, `Alarm '${alarm.name}' triggered at ${new Date().toLocaleTimeString()}.`);
        await autoSyncOpenFolderMails();
    }
});

browser.storage.onChanged.addListener((changes, areaName) => {
    const context = "storage.onChanged";
    if (areaName === 'local' && changes['tickets-settings']) {
        logger.info(context, "Settings have changed, re-evaluating alarms.");
        setupAlarm();
    }
});

async function OpenTicketURL() {
    const context = "OpenTicketURL";
    try {
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        if (!settings || !settings.ticketURL) {
            throw new Error("Ticket URL is not configured in settings.");
        }
        const subject = await getMessageSubject();
        if (!subject) {
            throw new Error("Could not retrieve the subject from the selected email.");
        }

        const ticketUrl = caseUrl(settings.ticketURL, subject);
        if (ticketUrl) {
            logger.info(context, `Opening URL: ${ticketUrl}`);
            browser.windows.openDefaultBrowser(ticketUrl);
            return { success: true };
        } else {
            throw new Error("No ticket ID found in the email subject.");
        }
    } catch (error) {
        logger.error(context, "Failed to open ticket URL:", error);
        throw error;
    }
}

async function ReturnTicketCaseID() {
    const context = "ReturnTicketCaseID";
    try {
        const subject = await getMessageSubject();
        const caseID = extractTicketID(subject);
        logger.info(context, `Extracted Case ID: ${caseID}`);
        return caseID;
    } catch (error) {
        logger.error(context, "Failed to retrieve case ID:", error);
        throw error;
    }
}

function extractTicketID(subject) {
    if (!subject) return null;
    const match = subject.match(/Ticket ID:\s*(\d+)/);
    return match ? match[1] : null;
}

function OpenGoogle() {
    logger.info("OpenGoogle", "Opening google.com in the default browser.");
    browser.windows.openDefaultBrowser("https://google.com");
}

async function getMessageSubject() {
    const context = "getMessageSubject";
    try {
        const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
        if (!mailTabs || mailTabs.length === 0) {
            throw new Error("No active mail tab is open.");
        }
        const selectedMessages = await browser.mailTabs.getSelectedMessages(mailTabs[0].id);
        if (!selectedMessages || selectedMessages.messages.length === 0) {
            throw new Error("No message is currently selected.");
        }
        return selectedMessages.messages[0].subject;
    } catch (error) {
        logger.error(context, "Could not get message subject:", error);
        throw error;
    }
}

function caseUrl(ticketURL, subject) {
    const caseID = extractTicketID(subject);
    if (caseID) {
        return `${ticketURL}${caseID}`;
    }
    return null;
}

async function GetAllFolders() {
    const context = "GetAllFolders";
    try {
        const accounts = await browser.accounts.list(true);
        const allFolders = [];

        function flatten(folder) {
            allFolders.push(folder);
            if (folder.subFolders) {
                for (const subFolder of folder.subFolders) {
                    flatten(subFolder);
                }
            }
        }

        for (const account of accounts) {
            if (account.folders) {
                for (const folder of account.folders) {
                    flatten(folder);
                }
            }
        }
        return allFolders;
    } catch (error) {
        logger.error(context, "Error retrieving folders:", error);
        return [];
    }
}

async function checkFolderExists(folderPath) {
    const context = "checkFolderExists";
    try {
        if (!folderPath) {
            return { exists: false, folder: null };
        }
        const allFolders = await GetAllFolders();
        const sanitizedPath = folderPath.trim().replace(/^\/+|\/+$/g, '');
        logger.debug(context, `Checking for sanitized path: '${sanitizedPath}'`);

        // First, try a direct match (full path with account)
        const directMatch = allFolders.find(f => f.path.trim().replace(/^\/+|\/+$/g, '') === sanitizedPath);
        if (directMatch) {
            logger.debug(context, `Found exact folder match for '${sanitizedPath}'`);
            return { exists: true, folder: directMatch };
        }
        
        // If no direct match, try to find a folder where the path ENDS with the provided path.
        logger.debug(context, "No exact match found. Checking for suffix match...");
        const possibleFolders = allFolders.filter(f => f.path.endsWith('/' + sanitizedPath) || f.path === sanitizedPath);

        if (possibleFolders.length >= 1) {
            const found = possibleFolders[0];
            if (possibleFolders.length > 1) {
                logger.warn(context, `Found multiple folders for ambiguous setting '${sanitizedPath}'. Using the first one found: '${found.path}' in account '${found.accountId}'. Please update settings to include the account name for correctness.`);
            }
            logger.debug(context, `Found suffix match for '${sanitizedPath}'. Path: '${found.path}'`);
            return { exists: true, folder: found };
        }

        logger.debug(context, `No folder found for '${sanitizedPath}'.`);
        return { exists: false, folder: null };
    } catch (error) {
        logger.error(context, `Error checking folder path "${folderPath}":`, error);
        return { exists: false, folder: null };
    }
}

async function createCaseFolder(folderPath) {
    const context = "createCaseFolder";
    
    if (!folderPath) {
        throw new Error("Folder path not provided.");
    }

    let checkResult = await checkFolderExists(folderPath);
    if (checkResult.exists) {
        logger.info(context, `Folder "${folderPath}" already exists.`);
        return { success: true, folder: checkResult.folder };
    }

    const defaultAccount = await browser.accounts.getDefault();
    logger.info(context, `Folder does not exist. Creating "${folderPath}" in default account "${defaultAccount.name}".`);

    const pathParts = folderPath.trim().replace(/^\/+|\/+$/g, '').split('/');
    
    let parentObject = defaultAccount;
    let searchFolders = defaultAccount.folders;
    let targetFolder = null;

    for (const part of pathParts) {
        let foundFolder = searchFolders.find(f => f.name === part);

        if (!foundFolder) {
            logger.info(context, `Creating folder part: "${part}" in parent: "${parentObject.name}"`);
            foundFolder = await browser.folders.create(parentObject, part);
        }
        
        targetFolder = foundFolder;
        parentObject = foundFolder;
        searchFolders = await browser.folders.getSubFolders(parentObject);
    }

    logger.info(context, `Full folder path created successfully: "${targetFolder.path}" in account "${defaultAccount.name}"`);
    return { success: true, folder: targetFolder };
}

async function archiveCaseFolder() {
    const context = "archiveCaseFolder";
    logger.info(context, "Archive process started.");
    try {
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        if (!settings || !settings.openedFolder || !settings.closedFolder) {
            throw new Error("Opened/Closed folder paths are not configured in settings.");
        }

        const { folder: openFolder } = await checkFolderExists(settings.openedFolder);
        if (!openFolder) {
            throw new Error(`The source "Opened" folder "${settings.openedFolder}" does not exist.`);
        }

        const { folder: closedFolderDestination } = await checkFolderExists(settings.closedFolder);
        if (!closedFolderDestination) {
            throw new Error(`The destination archive folder "${settings.closedFolder}" does not exist.`);
        }

        const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
        const currentFolder = mailTabs[0]?.displayedFolder;
        if (!currentFolder) {
            throw new Error("No folder is currently selected/displayed.");
        }

        const sourceFolderName = currentFolder.name;
        if (currentFolder.path.startsWith(openFolder.path)) {
            logger.info(context, `Archiving folder "${sourceFolderName}" from "${openFolder.path}" to "${closedFolderDestination.path}".`);
            try {
                await messenger.folders.move(currentFolder.id, closedFolderDestination.id);
            } catch (moveError) {
                logger.warn(context, `A non-critical error occurred during the move operation. Verifying...`, moveError);
            }

            const newFolderPath = `${closedFolderDestination.path}/${sourceFolderName}`;
            const { exists: moveSucceeded } = await checkFolderExists(newFolderPath);

            if (moveSucceeded) {
                logger.info(context, `Verification successful: Folder "${sourceFolderName}" moved to "${closedFolderDestination.path}".`);
                return { success: true, folderName: sourceFolderName };
            } else {
                throw new Error(`Verification failed: Could not find folder in "${closedFolderDestination.path}" after move.`);
            }
        } else {
            throw new Error(`Current folder "${sourceFolderName}" is not in the configured "Opened" directory.`);
        }
    } catch (error) {
        logger.error(context, "Error archiving case folder:", error);
        throw error;
    }
}

async function restoreArchivedFolder() {
    const context = "restoreArchivedFolder";
    logger.info(context, "Restore process started.");
    try {
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        if (!settings || !settings.openedFolder || !settings.closedFolder) {
            throw new Error("Opened/Closed folder paths are not configured in settings.");
        }

        const { folder: openFolderDestination } = await checkFolderExists(settings.openedFolder);
        if (!openFolderDestination) {
            throw new Error(`The destination "Opened" folder "${settings.openedFolder}" does not exist.`);
        }

        const { folder: closedFolder } = await checkFolderExists(settings.closedFolder);
        if (!closedFolder) {
            throw new Error(`The source "Closed" folder "${settings.closedFolder}" does not exist.`);
        }

        const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
        const currentFolder = mailTabs[0]?.displayedFolder;
        if (!currentFolder) {
            throw new Error("No folder is currently selected/displayed.");
        }

        const sourceFolderName = currentFolder.name;
        if (currentFolder.path.startsWith(closedFolder.path)) {
            logger.info(context, `Restoring folder "${sourceFolderName}" from "${closedFolder.path}" to "${openFolderDestination.path}".`);
            try {
                await messenger.folders.move(currentFolder.id, openFolderDestination.id);
            } catch (moveError) {
                logger.warn(context, `A non-critical error occurred during the restore operation. Verifying...`, moveError);
            }

            const newFolderPath = `${openFolderDestination.path}/${sourceFolderName}`;
            const { exists: moveSucceeded } = await checkFolderExists(newFolderPath);

            if (moveSucceeded) {
                logger.info(context, `Verification successful: Folder "${sourceFolderName}" restored to "${openFolderDestination.path}".`);
                return { success: true, folderName: sourceFolderName };
            } else {
                throw new Error(`Verification failed: Could not find folder in "${openFolderDestination.path}" after restore.`);
            }
        } else {
            throw new Error(`Current folder "${sourceFolderName}" is not in the configured "Closed" directory.`);
        }
    }
    catch (error) {
        logger.error(context, "Error restoring archived folder:", error);
        throw error;
    }
}

async function findAndMoveMessages(subjectToSearch, targetFolder, foldersToSearch) {
    const context = "findAndMoveMessages";
    let movedCount = 0;
    logger.debug(context, `Searching for ticket ID "${subjectToSearch}" in ${foldersToSearch.length} folder(s).`);

    for (const folder of foldersToSearch) {
        try {
            logger.debug(context, `Scanning folder: "${folder.path}"`);
            const messagesToMove = [];
            
            let page = await browser.messages.list(folder.id);
            while (page.messages.length > 0) {
                logger.debug(context, `Found ${page.messages.length} message(s) on this page in "${folder.path}".`);

                for (const message of page.messages) {
                    //logger.debug(context, `Checking subject: "${message.subject}"`);
                    if (message.subject && message.subject.includes(subjectToSearch)) {
                        messagesToMove.push(message.id);
                        logger.debug(context, `MATCH FOUND for ID "${subjectToSearch}" in subject: "${message.subject}"`);
                    }
                }

                if (!page.id) {
                    break; // No more pages
                }
                page = await browser.messages.continueList(page.id);
            }

            if (messagesToMove.length > 0) {
                logger.debug(context, `Moving ${messagesToMove.length} message(s) for ticket "${subjectToSearch}" from "${folder.path}" to "${targetFolder.path}".`);
                await browser.messages.move(messagesToMove, targetFolder.id);
                movedCount += messagesToMove.length;
            } else {
                logger.debug(context, `No matching messages found in "${folder.path}".`);
            }
        } catch (error) {
            logger.warn(context, `Could not process folder "${folder.path}". It might be a special or inaccessible folder.`, error);
        }
    }
    return movedCount;
}

async function syncFolderMails() {
    const context = "syncFolderMails";
    logger.info(context, "Pausing auto-sync alarm during manual sync.");
    await browser.alarms.clear("syncAlarm");

    try {
        const mailTabs = await browser.mailTabs.query({ active: true, currentWindow: true });
        const currentFolder = mailTabs[0]?.displayedFolder;
        if (!currentFolder) {
            throw new Error("No folder is currently selected.");
        }

        const match = currentFolder.name.match(/(\d{5,})/);
        if (!match) {
            throw new Error("The selected folder does not appear to be a ticket folder (no ID in name).");
        }
        const subjectToSearch = match[1];

        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        const syncFolderPaths = (settings?.syncFolders || 'INBOX').split(/[,;]/).map(p => p.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean);

        logger.info(context, `Syncing mails for ticket "${subjectToSearch}" into folder "${currentFolder.path}".`);
        logger.info(context, `Searching in paths: ${syncFolderPaths.join(', ')}.`);

        const allFolders = await GetAllFolders();
        const foldersToSearch = allFolders.filter(folder => 
            syncFolderPaths.some(searchPath => folder.path.endsWith('/' + searchPath) || folder.path === searchPath)
        );

        const movedCount = await findAndMoveMessages(subjectToSearch, currentFolder, foldersToSearch);

        logger.info(context, `Sync complete. Moved ${movedCount} messages for ticket "${subjectToSearch}".`);
        return { success: true, messagesCount: movedCount };
    } catch (error) {
        logger.error(context, "Error during mail sync:", error);
        throw error;
    } finally {
        logger.info(context, "Re-evaluating and re-enabling auto-sync alarm.");
        await setupAlarm();
    }
}

async function SyncALLFolderMails() {
    const context = "SyncALLFolderMails";
    let totalMovedCount = 0;
    
    logger.info(context, "Pausing auto-sync alarm during manual sync.");
    await browser.alarms.clear("syncAlarm");

    try {
        logger.info(context, "Starting sync for ALL ticket folders.");
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        if (!settings || !settings.openedFolder || !settings.closedFolder) {
            throw new Error("Opened and/or Closed folders are not configured in settings.");
        }

        const { folder: openFolderParent } = await checkFolderExists(settings.openedFolder);
        const { folder: closedFolderParent } = await checkFolderExists(settings.closedFolder);

        const openSubfolders = openFolderParent ? await browser.folders.getSubFolders(openFolderParent) : [];
        const closedSubfolders = closedFolderParent ? await browser.folders.getSubFolders(closedFolderParent) : [];
        const allTicketFolders = [...openSubfolders, ...closedSubfolders];

        if (allTicketFolders.length === 0) {
            logger.info(context, "No ticket folders found to sync.");
            return { success: true, messagesCount: 0 };
        }

        logger.info(context, `Found ${allTicketFolders.length} ticket folders to process.`);

        const syncFolderPaths = (settings?.syncFolders || 'INBOX').split(/[,;]/).map(p => p.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean);
        logger.info(context, `Searching for messages in paths: ${syncFolderPaths.join(', ')}.`);

        const allSystemFolders = await GetAllFolders();
        const foldersToSearch = allSystemFolders.filter(folder => 
            syncFolderPaths.some(searchPath => folder.path.endsWith('/' + searchPath) || folder.path === searchPath)
        );

        for (const ticketFolder of allTicketFolders) {
            const match = ticketFolder.name.match(/(\d{5,})/);
            if (!match) continue;

            const subjectToSearch = match[1];
            logger.debug(context, `Processing folder: ${ticketFolder.path} for ticket ID ${subjectToSearch}`);
            const movedCount = await findAndMoveMessages(subjectToSearch, ticketFolder, foldersToSearch);

            if (movedCount > 0) {
                logger.info(context, `Moved ${movedCount} messages for ticket "${subjectToSearch}" to folder "${ticketFolder.name}".`);
                totalMovedCount += movedCount;
            }
        }
        logger.info(context, `Finished sync for ALL folders. Total messages moved: ${totalMovedCount}.`);
        return { success: true, messagesCount: totalMovedCount };

    } catch (error) {
        logger.error(context, "Error during 'Sync All' operation:", error);
        throw error;
    } finally {
        logger.info(context, "Re-evaluating and re-enabling auto-sync alarm.");
        await setupAlarm();
    }
}

async function autoSyncOpenFolderMails() {
    const context = "autoSyncOpenFolderMails";
    try {
        logger.info(context, "Auto-sync process started.");
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        if (!settings || !settings.openedFolder) {
            logger.info(context, "Auto-sync skipped: 'Opened' folder path is not configured.");
            return;
        }

        const { folder: openFolderParent } = await checkFolderExists(settings.openedFolder);
        if (!openFolderParent) {
            logger.info(context, `Auto-sync skipped: Configured 'Opened' folder "${settings.openedFolder}" does not exist.`);
            return;
        }

        const openSubfolders = await browser.folders.getSubFolders(openFolderParent);
        if (openSubfolders.length === 0) {
            logger.info(context, "No subfolders found in the 'Opened' directory to sync.");
            return;
        }

        const syncFolderPaths = (settings?.syncFolders || 'INBOX').split(/[,;]/).map(p => p.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean);
        logger.info(context, `Auto-syncing ${openSubfolders.length} folder(s). Searching in paths: ${syncFolderPaths.join(', ')}.`);

        const allSystemFolders = await GetAllFolders();
        const foldersToSearch = allSystemFolders.filter(folder => 
            syncFolderPaths.some(searchPath => folder.path.endsWith('/' + searchPath) || folder.path === searchPath)
        );

        for (const openFolder of openSubfolders) {
            const match = openFolder.name.match(/(\d{5,})/);
            if (!match) continue;

            const subjectToSearch = match[1];
            const movedCount = await findAndMoveMessages(subjectToSearch, openFolder, foldersToSearch);

            if (movedCount > 0) {
                logger.info(context, `Moved ${movedCount} messages for ticket "${subjectToSearch}" to folder "${openFolder.name}".`);
            }
        }
        logger.info(context, "Auto-sync process finished.");
    } catch (error) {
        logger.error(context, "Error during auto-sync:", error);
    }
}
