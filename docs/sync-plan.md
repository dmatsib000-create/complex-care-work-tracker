# Plan: optional sync through her own Google Sheet (Option B prototype)

> **Status: proposal only. Nothing in this plan has been built.** The tracker does not sync between devices; it saves entries only in the browser, and backup files are the only way to move or keep them. Do not start building until both checks below are done:
> - her employer's IT policy allows work data (no PHI) in a personal Google account;
> - the hospital network does not block `script.google.com`.

## Context

Entries live only in one browser's localStorage. She logs on **her iPhone, a personal computer, and a hospital workstation**, so each device is an island and the workstation may wipe data at sign-out. Backup files help but depend on remembering. Option A (File System Access) does not cover iPhone; Option C leaves the gap. So: **Option B, sync through a Google Sheet + Apps Script web app in her own account.**

IT policy and whether hospital networks reach `script.google.com` are **not confirmed yet**, so sync is **off by default and opt-in**. With it off, the page behaves exactly as today (no network requests). With it off or unreachable, everything still saves locally and backup files keep working.

## Starting point

Updated 2026-11-14 for the current `main` (96b8cee). The backup GUI this builds on is now merged (PR #6): the status line under the title, the "Back up and restore" panel, `renderBackup`, `markBackedUp`, plus the review fixes in f5a18f0. Build on the latest `main`; no other branch needs merging first.

What is already on `main` that this plan reuses or must keep working:
- `ccwt_buttons_changed_v1` (`LS_BTN_CHANGED`, `buttonsChangedAt()`), stamped by `buttonsChanged()`. The status line already counts button changes since the last backup.
- `restoreBackup` counts a file as a full backup only when it has every entry here, each at least as recently edited, and the same buttons (`covered`, `fileEdit`); it then moves `LS_BACKUP` and may lower `LS_BTN_CHANGED` to the file's `savedAt`.
- `askPersist()` asks for persistent storage once per browser (`ccwt_persist_asked_v1`).
- The `storage` listener already re-renders on `LS_BACKUP` and `LS_BTN_CHANGED`.

## Design

### Server: `sync/Code.gs` (new, she pastes it into Apps Script)
- Bound to a Google Sheet. Sheet `entries`: one row per entry, columns `id | changedAt | deleted | rev | date | label | minutes | clinic | who | json` (readable columns so she can glance at the Sheet; `json` is the source of truth). One row with id `buttons` holds the custom button list.
- `makeSyncKey()`: run once from the editor; stores a random key in Script Properties and logs it.
- `doPost(e)`: body is `text/plain` JSON `{key, since, changes:[...], buttons?}` (text/plain avoids a CORS preflight; Apps Script's redirect response is readable cross-origin). Checks the key, takes `LockService` script lock, then for each change keeps the copy with the larger `changedAt` (tombstones included), bumps a monotonic `rev` counter on rows it writes, and returns `{ok, rev, changes: rows with rev > since, buttons}`.
- Core merge kept as a pure function (`mergeRows`) with thin Sheet I/O around it, so tests can load the file in Node with fake `SpreadsheetApp` / `LockService` / `PropertiesService` / `ContentService`.
- Deployed as Web app, Execute as: Me, Who has access: Anyone. The key is the access control; the URL plus key is the credential.

### Client: `tracker.html`
1. **One merge function shared by restore and sync.** Extract the per-id decision from `restoreBackup` into `mergeEntries(list, deletedMap)`: newer wins by `changedAt(e)` (the existing helper: `max(id, updatedAt)`, so a never-edited copy never replaces an edited one, same as today). `restoreBackup` keeps its current messages and behaviour, now via this function, including the `covered` / `fileEdit` full-backup check and its `LS_BTN_CHANGED` adjustment.
2. **Tombstones.** `delEntry` records `{id: deletedAt}` in new key `ccwt_deleted_v1` (kept out of `entries`, so rendering code is untouched). A tombstone beats any copy changed at or before `deletedAt`; a later edit elsewhere beats the tombstone. Backup files gain an additive `deleted` field (format stays 1); restoring applies it, and a restore no longer resurrects an entry deleted here after the backup's copy was last changed (message: "N deleted here were not brought back"). Tombstones are tiny and kept indefinitely.
3. **Buttons.** Reuse the existing `ccwt_buttons_changed_v1` stamp (`buttonsChangedAt()`); sync is last-writer-wins on it (never-changed defaults have stamp 0, so a synced list wins on a new device). Two gaps to close: a restore that takes the file's buttons (`useButtons`) does not stamp today, and buttons received by sync must set the stamp to the sender's time, not `Date.now()`, so they are not pushed straight back as newer. The full-backup check lowering the stamp to `savedAt` stays as is.
4. **Sync state** in `ccwt_sync_v1`: `{url, key, rev, pushedAt, lastOkAt, lastError}`. URL must match `https://script.google.com/macros/s/<id>/exec`; nothing else is accepted, so the page can only ever talk to her own script.
5. **When it syncs:** on load, ~2 s after any `save()` (debounced), on `visibilitychange` to visible, on `online`, and every 5 min while visible. Push = entries/tombstones with `changedAt > pushedAt` (first sync pushes everything) plus buttons if newer. On response: `loadState()` fresh from storage, apply returned changes with `mergeEntries`, `save()`, `render()`, all synchronously so a second tab cannot interleave. One request in flight per tab; the existing `storage` listener keeps tabs in step (add `ccwt_deleted_v1` and `ccwt_sync_v1` to the keys it watches). Running timers stay per device (not synced).
6. **UI (inside the existing panel and status line, no new tab):**
   - New "Sync between devices (optional)" section in `#backupPanel`: short note (her own Google account, check workplace policy, no PHI), fields for the web app URL and sync key, Connect / Sync now / Turn off sync on this device. Connect does a first sync and reports "Connected. Sent N, received M."
   - Status line (`renderBackup`) when sync is on: "Synced with your Google Sheet at 10:42." / "3 changes waiting to sync. Last synced yesterday." / "Could not reach your Google Sheet (check the connection)." Amber uses today's rule, with "safe" meaning in a backup file **or** synced: `notBackedUp` uses `max(lastBackupAt, pushedAt-of-last-success)`, and the button-change check in `renderBackup` (`btnNew`) uses the same time, so synced button changes stop counting as unsaved.
   - Wrong key or bad URL: clear message, sync stays off, nothing changes locally.
7. Update the page's privacy line ("Entries are saved only in this browser...") to reflect sync when on.

### Tests (`npm test`, Playwright)
- `tests/helpers.js`: `fakeSheet()` loads `sync/Code.gs` in `vm` with fake Apps Script services; `connectSync(context, server)` routes `https://script.google.com/macros/s/TEST/exec` into it.
- Replace the network assertion in `tests/tracking.test.js` with: **no requests while sync is off** (unchanged guarantee), and **with sync on, requests go only to the configured script URL**.
- New `tests/cloud-sync.test.js` (two contexts = phone and computer, one fake server):
  - add on A appears on B; edit on B (newer) wins on A; an older edit does not overwrite a newer one
  - delete on A removes it on B, and restoring an older backup file on B does not bring it back
  - offline (route aborts): status shows changes waiting, local saves still work, sync completes once back
  - wrong key: refused with a message, no local change; non-Google URL rejected
  - buttons changed on A reach B; a running timer does not
  - first connect on a device with existing entries merges both ways
- `tests/backup.test.js`: existing restore tests keep passing (merge semantics unchanged); add tombstone-in-backup case.
- Unit test for `mergeRows` in `sync/Code.gs` (pure function, node only).

### Docs
- README: new "Sync between devices (optional)" section: setup steps (new Sheet, Extensions > Apps Script, paste `sync/Code.gs`, run `makeSyncKey`, Deploy as web app with the settings above, paste URL and key on each device including the iPhone Home Screen icon), check workplace policy first, hospital networks may block Google (local saving and backup files still work), last-edit-wins depends on device clocks, deletes now travel. Update "Privacy and safety" and "Files"; change "makes no network requests" to "makes no network requests unless you turn on sync".
- `docs/data-dictionary.md`: `updatedAt`, tombstones, and the Sheet columns.

## Critical files
- `tracker.html` (merge refactor in `restoreBackup`, `delEntry`, `buttonsChanged`, `save`, `renderBackup`, `#backupPanel` markup, storage listener)
- `sync/Code.gs` (new)
- `tests/helpers.js`, `tests/tracking.test.js`, `tests/backup.test.js`, `tests/cloud-sync.test.js` (new)
- `README.md`, `docs/data-dictionary.md`

## Verification
1. `npm test`: all existing tests plus the new ones pass.
2. Manual run with Playwright against the fake server: two windows, add/edit/delete, screenshot the status line and panel at phone width (390px) and desktop.
3. Note for her (cannot be done from here): a real end-to-end check needs deploying `sync/Code.gs` in her Google account and trying it once from the hospital network, after checking IT policy.

## Out of scope for this prototype
Syncing a running timer, a one-tap setup link for new devices, pruning old tombstones, Option A.
