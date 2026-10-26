# Android Drive backups and release signing

## Google Drive integration status

The Android provider is implemented in `GoogleDriveBackup` and is registered in the native bridge. It uses Google Play services `AuthorizationClient`, requests only `https://www.googleapis.com/auth/drive.appdata`, writes JSON backups in the app-private Drive application-data folder, lists the newest matching backups, and reads a newly uploaded file back byte-for-byte before returning `verified: true`. Network requests use Android's active validated network; both Wi-Fi and cellular transports are accepted. Offline state, denied/revoked permission, HTTP authorization errors, incomplete upload, and unreadable/corrupt backup are returned as errors. Authorization tokens remain in native Android code.

The provider is deliberately **off by default**. Gradle sets `INORDINE_DRIVE_BACKUP_ENABLED=false` unless the build environment sets it to `true`. GitHub Actions reads the repository Actions variable of the same name. No Google Cloud project or OAuth credential is stored in this repository, and no live Google API request has been tested from this source tree.

Before enabling it, a project owner must:

1. Create or select a Google Cloud project and enable the Google Drive API.
2. Configure the OAuth consent screen and permitted test users / publication status.
3. Register an Android OAuth client for package `it.inordine.app.test` and the SHA-1 certificate fingerprint of the stable signing key used by the TEST build.
4. Set the repository Actions variable `INORDINE_DRIVE_BACKUP_ENABLED` to `true` only after the Google configuration and signing fingerprint match.
5. Install and test an APK signed with that same persistent key, including consent, upload/readback, listing, mobile data, offline, revoked access, and restore.

`drive.appdata` is restricted to this app's private Drive application-data area and avoids broad access to the user's documents. Google hides that area from the Drive UI; the user cannot browse or share those files there. Google documents that app data can be removed if the user removes the app's data folder / app access. The existing manual Android file-picker route remains available for visible, portable backup files.

Google classifies `drive.appdata` as a non-sensitive Drive scope. That avoids the sensitive/restricted-scope review path, but the OAuth consent/brand configuration and any baseline verification required for public availability still need to be checked in the Cloud Console.

The browser/SAF route can verify that Android wrote and re-read the selected file. It cannot verify the Drive provider's later cloud synchronization queue, so that route never reports a cloud-verified backup. The direct provider reports success only after Google Drive accepts the upload and returns the same bytes on a subsequent read.

## iOS and cross-platform reuse (planning only)

No iOS app or iOS provider is included in this branch. The portable parts are the JSON backup envelope (`format: in-ordine-backup`, `schemaVersion: 1`), the existing state payload, the legacy readers, and the provider-neutral `createBackupCloudService` contract. Android and iOS can exchange backups through the existing manual JSON file route without sharing app data containers or Google credentials.

An iOS implementation would need a Capacitor iOS bridge matching `GoogleDriveBackup`'s `getStatus`, `saveBackup`, `listBackups`, `readBackup`, and `disconnect` methods. It should use an iOS OAuth client registered for the iOS bundle identifier, request only `drive.appdata`, keep access tokens in native code, and use the same Drive REST endpoints and upload-readback verification. Google requires the iOS client ID and its URL scheme in the iOS app configuration; no web/server client ID is needed unless a server is added. The iOS client must be in the Google Cloud project associated with the Drive app data. Confirm that Android- and iOS-created `appDataFolder` files are visible to both clients in a real two-platform test before promising automatic cross-platform discovery.

The checksum is SHA-256 over UTF-8 JSON produced by recursively sorting object keys using JavaScript `JSON.stringify` number/string encoding. A Swift implementation must match those canonicalization and encoding rules exactly, or it must keep using the original JSON bytes for parsing and validate against Android-generated golden fixtures. Arrays retain their order. Do not change the envelope or checksum rules without a versioned migration; continue accepting both `in-ordine-v2` and raw version-2 state backups.

For manual iPhone transfer, `UIDocumentPickerViewController` can import/export the `.json` file. External document URLs are security-scoped and must be accessed with the iOS document coordination rules. Automatic cloud upload and restore need a separate iOS native implementation and tests for consent, revocation, mobile connectivity, upload interruption, and readback. These are future implementation tasks; this change adds documentation only.

Reference documentation: [Google Drive app data](https://developers.google.com/workspace/drive/api/guides/appdata), [Google Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios/start-integrating), and [Apple document picker](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller).

## Stable signing key setup

The workflow accepts four GitHub Actions secrets and does not commit or generate a keystore:

- `INORDINE_SIGNING_KEYSTORE_BASE64`
- `INORDINE_SIGNING_STORE_PASSWORD`
- `INORDINE_SIGNING_KEY_ALIAS`
- `INORDINE_SIGNING_KEY_PASSWORD`

When all four are configured, the workflow decodes the keystore in the runner's temporary directory, checks its alias/password, signs the APK, compares the APK certificate SHA-256 fingerprint with the keystore certificate, and only then uploads the APK artifact. If none are configured, Actions verifies the Gradle CI debug signature with `apksigner`, then uploads the APK as a short-lived (14 day) Actions artifact after all app checks pass. This exception applies only to the `qa` flavor (`it.inordine.app.test`); pull requests do not publish it. A partial set fails the workflow.

To provision a stable key safely, the release owner should create it on a controlled machine with `keytool`, use a long unique password, store at least two encrypted offline copies in separate secure locations, record the alias and certificate fingerprints, and verify restoration from an encrypted copy before configuring GitHub secrets. Then base64-encode the keystore and add the four values as repository Actions secrets. Never put the keystore, passwords, or decoded file in source control, logs, artifacts, or an issue. Restrict repository secret access and retain an offline recovery copy; loss of the private key makes future same-package updates impossible.

### Existing PROVA installation compatibility

The historical PROVA APK was signed with an ephemeral GitHub Actions debug key. That private key was not retained, so it cannot be recovered from the APK. A newly provisioned stable key therefore **cannot** be proven compatible with the PROVA currently installed on the user's phone. The original app's application ID and signing configuration are untouched. PROVA remains a separate Gradle flavor with package `it.inordine.app.prova`.

The separately approved TEST flavor uses package `it.inordine.app.test` and display name `In Ordine TEST`; it installs alongside both existing apps and has its own Android application data. GitHub Actions builds `assembleQaDebug`. The stable-signing secrets can sign only that selected TEST build in the distribution workflow. Without those secrets, the workflow permits a TEST-only debug-signed artifact; its certificate can change between runs, so Android may require uninstalling a prior TEST build before installation. This is not for production distribution. The first TEST package version starts at code `1`. Before a signed APK can be uploaded, set repository variable `INORDINE_TEST_VERSION_CODE` to a positive version code, then increment it for each subsequent distributed update. The build fails if persistent signing secrets exist but this variable is missing or invalid.

For an update to install over an existing Android app, the application ID and signing certificate must match; Android also requires an equal or higher `versionCode`. Increment `versionCode` for every future distributed build. The repository currently keeps `versionCode 1` and no APK is being distributed by this task.

No persistent key has been created or saved in a recoverable secure location, and the GitHub signing secrets are not configured. Stable signing is therefore not verified. The current user-authorized path produces a clearly labeled, TEST-only debug-signed artifact that may require uninstall/reinstall when refreshed; it is not suitable for a production release. This does not affect the existing PROVA app or the original app.
