const APP_PREFIX = "[MyTickets]";
let isDebugMode = false;
const getTimestamp = () => new Date().toLocaleTimeString();

// Function to update the debug mode status from storage
async function updateDebugMode() {
    try {
        const { 'tickets-settings': settings } = await browser.storage.local.get('tickets-settings');
        // Enable debug mode if the setting is explicitly true, otherwise disable it.
        isDebugMode = settings?.debugMode === true || settings?.debugMode === 'true';
    } catch (e) {
        // Use a standard console.error here since our logger might not be ready.
        console.error(`[${getTimestamp()}] ${APP_PREFIX} [logger] Failed to read debug mode setting`, e);
        isDebugMode = false; // Default to false on error
    }
}

// Listen for changes in storage to keep debugMode up to date
browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['tickets-settings']) {
        const oldDebug = isDebugMode;
        updateDebugMode().then(() => {
            if (isDebugMode !== oldDebug) {
                console.info(`[${getTimestamp()}] ${APP_PREFIX} [logger] Debug mode has been ${isDebugMode ? 'ENABLED' : 'DISABLED'}.`);
            }
        });
    }
});

// Initial load of the debug setting
updateDebugMode();

export const logger = {
    info: (context, ...args) => console.info(`[${getTimestamp()}] ${APP_PREFIX} [${context}]`, ...args),
    warn: (context, ...args) => console.warn(`[${getTimestamp()}] ${APP_PREFIX} [${context}]`, ...args),
    error: (context, ...args) => console.error(`[${getTimestamp()}] ${APP_PREFIX} [${context}]`, ...args),
    // Debug logs only appear if debugMode is true
    debug: (context, ...args) => {
        if (isDebugMode) {
            console.debug(`[${getTimestamp()}] ${APP_PREFIX} [${context}]`, ...args);
        }
    }
}; 