/**
 * One Bite Cookie – Receipt uploader (Google Apps Script)
 *
 * Setup (one time, ~3 minutes):
 *  1. Go to https://script.google.com  → New project, paste this whole file.
 *  2. Change SECRET below to a long random string.
 *  3. Deploy → New deployment → type "Web app"
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Authorise when prompted, then copy the Web app URL (ends with /exec).
 *  4. In .env.local (and your hosting env vars) add:
 *       GOOGLE_DRIVE_UPLOAD_URL=<the /exec URL>
 *       GOOGLE_DRIVE_UPLOAD_SECRET=<same SECRET as below>
 *  5. Restart `npm run dev`.
 */

const FOLDER_ID = '1CxUKoiIQ5oicc6Eo-vun2pC0-2mG0joh'; // Team receipts folder
const SECRET = 'obc_sec_1dfe5126b5534c34a1dc3778ac96b7f9';

// Run this in the editor toolbar to test folder access directly:
function testAuth() {
  try {
    let folder;
    try {
      folder = DriveApp.getFolderById(FOLDER_ID);
      Logger.log('Connected to shared receipts folder: ' + folder.getName());
    } catch (e) {
      Logger.log('Shared folder not found or view-only, falling back to OneBite_Receipts in My Drive: ' + e);
      const it = DriveApp.getRootFolder().getFoldersByName('OneBite_Receipts');
      folder = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder('OneBite_Receipts');
    }
    const testFile = folder.createFile('test_auth.txt', 'OK');
    Logger.log('Test file created: ' + testFile.getUrl());
    testFile.setTrashed(true);
    Logger.log('SUCCESS! Google Drive access is 100% working!');
  } catch (err) {
    Logger.log('ERROR: ' + err);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ ok: false, error: 'unauthorized' });

    const bytes = Utilities.base64Decode(body.data);
    const blob = Utilities.newBlob(bytes, body.mimeType || 'image/jpeg', body.fileName || ('receipt_' + Date.now() + '.jpg'));

    // Try team folder first; fallback to "OneBite_Receipts" in My Drive if permission denied
    let root;
    try {
      root = DriveApp.getFolderById(FOLDER_ID);
    } catch (e) {
      const it = DriveApp.getRootFolder().getFoldersByName('OneBite_Receipts');
      root = it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder('OneBite_Receipts');
    }

    const month = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM');
    let folder;
    try {
      const it = root.getFoldersByName(month);
      folder = it.hasNext() ? it.next() : root.createFolder(month);
    } catch (e) {
      folder = root;
    }

    const file = folder.createFile(blob);
    if (body.uploadedBy) {
      try { file.setDescription('Uploaded by ' + body.uploadedBy); } catch (e) {}
    }
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      // Ignore if sharing restriction applies
    }

    const id = file.getId();
    return json_({ ok: true, id: id, url: 'https://drive.google.com/file/d/' + id + '/view' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
