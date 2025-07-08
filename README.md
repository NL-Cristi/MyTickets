	
#Overview
The tool is a solution for support ticket management, offering functionalities such as creating and archiving ticket folders, syncing emails, and interacting with Web Cases Portal. It is built using JavaScript and leverages the WebExtensions API for Thunderbird.

#Prerequisites:
MyFolders exists as a folder under your INBOX.

#Features:
- Open ticketID from mail subject in default Browser using the URL provided Via Settings.
- This feature was tested with ZenDesk( https://zendeskDomain.zendesk.com/agent/tickets/IdFromEmailSubject)
- If your Ticket portal respects the pattern you can use the Open Feature.
- Save Ticket URL via Settings button. Url will append the ID from TicketID and it will be used to Open the URL in the default Browser.
- Auto sync. Allow the option of Enabling/Disabling AutoSync.
- Auto Sync Interval - Set the sync Interval in minutes.
- Create Open and Closed folders for monitoring Ticket folders.
- Manual Sync if Ticket folder - Search Inbox, and Send folders for all mails with the id from the folder name and move them under the folder(under Opened and Closed Ticket Folders).
- Auto Sync Ticket folder every 5 minutes ONLY for the folders under OPEN.
- Archive Open Ticket folder - Move Ticket folder under Closed.
- ReOpen Archived Ticket Folders - Move Folder from under Closed under Open and restart sync monitoring.

#Conclusion
This thunderbird extension is a powerful tool for support engineers and customer service teams. By automating repetitive tasks and providing easy access to essential functions, it helps streamline the process of managing support tickets. The integration with Your Ticketing system and autoSync local email saves time and reduce the potential for errors, making it an invaluable addition to any support workflow.
