# Android Drive backups and release signing

## Google Drive integration status

The Android provider is implemented in `GoogleDriveBackup` and is registered in the native bridge. It uses Google Play services `AuthorizationClient`, requests only `https://www.googleapis.com/auth/drive.appdata`, writes JSON backups in the app-private Drive application-data folder, lists the newest matching backups, and reads a newly uploaded file back byte-for-byte before returning `verified: true`. Network requests use Android's active validated network; both Wi-Fi and cellular transports are accepted. Offline state, denied/revoked permission, HTTP authorization errors, incomplete upload, and unreadable/corrupt backup are returned as errors. Authorization tokens remain in native Android code.

The provider is deliberately **off by default**. Gradle sets `INORDINE_DRIVE_BACKUP_ENABLED=false` unless the build environment sets it to `true`. GitHub Actions reads the repository Actions variable of the same name. No Google Cloud project or OAuth credential is stored in this repository, and no live Google API request has been tested from this source tree.

Before enabling it, a project owner must:

1. Create or select a Google Cloud project and enable the Google Drive API.
2. Configure the OAuth consent screen and permitted test users / publication status.
3. Register an Android OAuth client for package `it.inordine.app.prova` and the SHA-1 certificate fingerprint of the stable signing key used by the build.
4. Set the repository Actions variable `INORDINE_DRIVE_BACKUP_ENABLED` to `true` only after the Google configuration and signing fingerprint match.
5. Install and test an APK signed with that same persistent key, including consent, upload/readback, listing, mobile data, offline, revoked access, and restore.

`drive.appdata` is restricted to this app's private Drive application-data area and avoids broad access to the user's documents. Google hides that area from the Drive UI; the user cannot browse or share those files there. Google documents that app data can be removed if the user removes the app's data folder / app access. The existing manual Android file-picker route remains available for visible, portable backup files.

The browser/SAF route can verify that Android wrote and re-read the selected file. It cannot verify the Drive provider's later cloud synchronization queue, so that route never reports a cloud-verified backup. The direct provider reports success only after Google Drive accepts the upload and returns the same bytes on a subsequent read.

## Stable signing key setup

The workflow accepts four GitHub Actions secrets and does not commit or generate a keystore:

- `INORDINE_SIGNING_KEYSTORE_BASE64`
- `INORDINE_SIGNING_STORE_PASSWORD`
- `INORDINE_SIGNING_KEY_ALIAS`
- `INORDINE_SIGNING_KEY_PASSWORD`

When all four are configured, the workflow decodes the keystore in the runner's temporary directory, checks its alias/password, signs the APK, compares the APK certificate SHA-256 fingerprint with the keystore certificate, and only then uploads the APK artifact. If none are configured, the workflow runs validation with ephemeral CI debug signing and publishes no APK artifact. A partial set fails the workflow.

To provision a stable key safely, the release owner should create it on a controlled machine with `keytool`, use a long unique password, store at least two encrypted offline copies in separate secure locations, record the alias and certificate fingerprints, and verify restoration from an encrypted copy before configuring GitHub secrets. Then base64-encode the keystore and add the four values as repository Actions secrets. Never put the keystore, passwords, or decoded file in source control, logs, artifacts, or an issue. Restrict repository secret access and retain an offline recovery copy; loss of the private key makes future same-package updates impossible.

### Existing PROVA installation compatibility

The historical PROVA APK was signed with an ephemeral GitHub Actions debug key. That private key was not retained, so it cannot be recovered from the APK. A newly provisioned stable key therefore **cannot** be proven compatible with the PROVA currently installed on the user's phone. This repository keeps package `it.inordine.app.prova`, but no APK signed with a different key should be installed over the existing PROVA app. Do not ask the user to uninstall it. A future test installation needs either recovery of the exact old key (not available) or a separately approved new application ID; its migration/installation must be planned separately. The original app's application ID and signing configuration are untouched.

The stable-key workflow is prepared but the signing key and GitHub secrets are not configured. Stable signing is not yet verified.
