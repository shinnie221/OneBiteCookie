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
const SECRET = 'CHANGE-ME-to-a-long-random-string';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json_({ ok: false, error: 'unauthorized' });

    const bytes = Utilities.base64Decode(body.data);
    const blob = Utilities.newBlob(bytes, body.mimeType || 'image/jpeg', body.fileName || ('receipt_' + Date.now() + '.jpg'));

    // Organise into monthly sub-folders, e.g. "2026-10"
    const root = DriveApp.getFolderById(FOLDER_ID);
    const month = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyy-MM');
    const it = root.getFoldersByName(month);
    const folder = it.hasNext() ? it.next() : root.createFolder(month);

    const file = folder.createFile(blob);
    if (body.uploadedBy) file.setDescription('Uploaded by ' + body.uploadedBy);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const id = file.getId();
    return json_({ ok: true, id: id, url: 'https://drive.google.com/file/d/' + id + '/view' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
