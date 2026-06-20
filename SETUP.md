# K for Kids Library — Setup Guide

## What you're deploying
A Google Apps Script web app with two views:
- **Subscriber view** — browse all books, see availability, reserve a book (open to anyone with the link)
- **Admin view** — issue books, cancel reservations, mark returns (password-protected)

---

## Step 1 — Open Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click **+ New Project**
3. Rename it to `K for Kids Library`

---

## Step 2 — Add the two files

### File 1: Code.gs
The project already has a default `Code.gs` file. Replace all its contents with the contents of `Code.gs` from this folder.

### File 2: Index.html
1. In the Apps Script editor, click **+** (Add a file) → **HTML**
2. Name it exactly `Index` (no extension — Apps Script adds `.html` automatically)
3. Replace all its contents with the contents of `Index.html` from this folder.

---

## Step 3 — Set your admin password

1. In the Apps Script editor, click the **⚙ Project Settings** (gear icon, left sidebar)
2. Scroll down to **Script Properties**
3. Click **Add Script Property**
4. Key: `ADMIN_PASSWORD` → Value: (choose your own password)
5. Click **Save script properties**

> This step is required. Admin actions are disabled until `ADMIN_PASSWORD` is set.

---

## Step 4 — Check your sheet tab name

Open your spreadsheet. Look at the sheet tabs at the bottom. The tab containing your book list must be named exactly **`Master DB`**.

If it has a different name, update line 10 in `Code.gs`:
```javascript
MASTER_SHEET_NAME: 'Master DB',   // ← change this to match your tab name
```

The script will automatically add these columns to your sheet on first run:
`Status | Reserved By | Phone | Pickup Date | Issue Date | Notes`

---

## Step 5 — Make your book cover images accessible

Your subscribers will see book covers only if the Drive folders are shared as **"Anyone with the link can view"**.

1. Open each folder in Google Drive:
   - `https://drive.google.com/drive/folders/1lvF-70-p8bdo_LIvoDkW-nbtLEZ4-H8i`
   - `https://drive.google.com/drive/folders/1PgvawApfIdWxF3atheIYR7rlx3kRTqcz`
2. Right-click → **Share** → **Anyone with the link** → **Viewer**

> Image files should be named starting with the book number, e.g., `M0001.jpg`, `E0042.jpg`

---

## Step 6 — Deploy as a Web App

1. In Apps Script editor, click **Deploy** → **New deployment**
2. Click the **⚙** (gear) next to "Select type" → choose **Web app**
3. Set:
   - **Description**: K for Kids Library v1
   - **Execute as**: Me (your Google account)
   - **Who has access**: **Anyone** ← important, so subscribers can use it
4. Click **Deploy**
5. **Authorize** the app when prompted (you'll need to allow Drive and Sheets access)
6. Copy the **Web App URL** — this is the link you share with subscribers!

---

## Step 7 — Share the link

Send the Web App URL to your subscribers via WhatsApp. They can:
- Browse all books
- Search by title, author, or book number
- Filter by language or availability
- Reserve a book (they enter their name + phone + preferred pickup date)

---

## How admin mode works

1. In the web app, tap the **🔒 shield icon** (top right)
2. Enter your admin password
3. You'll see "Admin Mode" badge appear
4. Open any book → you'll see **Admin Actions** panel:
   - **Mark as Issued** — records the subscriber name + date in the sheet
   - **Cancel Reservation** — frees up the book
   - **Mark as Returned** — makes the book available again

---

## Updating books

Continue managing your book list directly in the Google Sheet as you do today. The web app reads live from the sheet — any change you make in Sheets is reflected immediately in the app.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Sheet not found" error | Check the tab name matches `MASTER_SHEET_NAME` in Code.gs |
| Book covers not showing | Ensure the Drive folders are shared as "Anyone with link" |
| Admin password not working | Verify Script Properties has key `ADMIN_PASSWORD` set |
| App asks to authorize again | Re-deploy with a new deployment version |

---

## Optional: Change admin password from the app

You can add this function call in the Apps Script console to change the password programmatically:

```javascript
changeAdminPassword('oldPassword', 'newPassword')
```
