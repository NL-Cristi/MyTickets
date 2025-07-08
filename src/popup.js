console.log("PopUp script loaded");  // Log when the popup script is loaded

// Hide the openTicketURLButton if ticketURL is not present in local storage
browser.storage.local.get('ticketURL').then(data => {
    if (!data.ticketURL) {
        document.getElementById('openTicketURLButton').style.display = 'none';
    }
}).catch(error => {
    console.error("Error accessing storage: ", error);
});

// Open settings popup
document.getElementById('settingsButton').addEventListener('click', function () {
    browser.windows.create({
        url: "settings.html",
        type: "popup",
        width: 400,
        height: 400
    });
});

// Listen for the message from the popup
window.addEventListener('message', function (event) {
    if (event.data.action === "createCaseFolder") {
        console.log("Folder name received:", event.data.folderName);
        // You can add further processing of the folder name here
        // For example, creating the folder in the background script
    }
});

document.getElementById('openCaseButton').addEventListener('click', function () {
    var folderName = window.prompt("Enter the name of the case folder:");
    if (folderName !== null && folderName.trim() !== "") {
        browser.runtime.sendMessage({ action: "openGoogle", folderName: folderName.trim() });
    } else {
        console.log("User did not provide a valid case folder name.");
    }
});

document.getElementById('closeCaseFolderButton').addEventListener('click', function () {
    browser.runtime.sendMessage({ action: "closeCaseFolder" }, (response) => {
        if (browser.runtime.lastError) {
            console.error("Error retrieving case ID: ", browser.runtime.lastError);
            return;
        }
        if (response.error) {
            console.error("Error: ", response.error);
            window.alert(response.error);

        } else {
            console.info(response.folderName + " archived successfully");
            window.alert(response.folderName + " archived successfully");
        }
    });
});

document.getElementById('syncFolderButton').addEventListener('click', function () {
    browser.runtime.sendMessage({ action: "syncFolderMails" }, (response) => {
        if (browser.runtime.lastError) {
            console.error("Error retrieving case ID: ", browser.runtime.lastError);
            return;
        }
        if (response.error) {
            console.error("Error: ", response.error);
            window.alert(response.error);

        } else {
            console.info("Moved " + response.messagesCount + " mails to the folder");
            window.alert("Moved " + response.messagesCount + " mails to the folder");
        }
    });
});

document.getElementById('getCaseIDButton').addEventListener('click', function () {
    browser.runtime.sendMessage({ action: "getCaseID" }, (response) => {
        if (browser.runtime.lastError) {
            console.error("Error retrieving case ID: ", browser.runtime.lastError);
            return;
        }
        if (response.error) {
            console.error("Error: ", response.error);
            window.alert("Error retrieving case ID: " + response.error);

        } else {
            console.log("Case ID: ", response.caseID);
            window.alert("Case ID: " + response.caseID);
        }
    });
});

document.getElementById('openTicketURLButton').addEventListener('click', function () {
    browser.storage.local.get('ticketURL').then(data => {
        if (!data.ticketURL) {
            window.alert("Ticket URL is not set. Please set it in the settings.");
            return;
        }

        browser.runtime.sendMessage({ action: "openTicketURL" }, (response) => {
            if (browser.runtime.lastError) {
                console.error("Error opening case: ", browser.runtime.lastError);
                return;
            }
            if (response.error) {
                console.error("Error: ", response.error);
                window.alert("Error opening case: " + response.error);
            } else {
                console.log("Case opened successfully");
            }
        });
    }).catch(error => {
        console.error("Error accessing storage: ", error);
        window.alert("Error accessing storage: " + error.message);
    });
});

document.getElementById('restoreArchiveButton').addEventListener('click', function () {
    browser.runtime.sendMessage({ action: "restoreArchivedFolder" }, (response) => {
        if (browser.runtime.lastError) {
            console.error("Error retrieving case ID: ", browser.runtime.lastError);
            return;
        }
        if (response.error) {
            console.error("Error: ", response.error);
            window.alert(response.error);

        } else {
            console.info(response.folderName + " reOpened successfully");
            window.alert(response.folderName + " reOpened successfully");
        }
    });
});

const showBtn = document.getElementById("create-folder-show-dialog");
const dialog = document.getElementById("folder-dialog");
const jsSaveBtn = dialog.querySelector("#save");
const jsCancelBtn = dialog.querySelector("#cancel");

const form = document.getElementById("folder-form");
const folderInput = document.getElementById("folder-input");
const cancelBtn = document.getElementById("cancel");

showBtn.addEventListener("click", () => {
    dialog.showModal();
});

jsSaveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log(folderInput.value);
    browser.runtime.sendMessage({ action: "createCaseFolder", folderName: folderInput.value });
    dialog.close();
});
jsCancelBtn.addEventListener("click", (e) => {
    dialog.close();
});
cancelBtn.addEventListener("click", () => {
    dialog.close();
});
