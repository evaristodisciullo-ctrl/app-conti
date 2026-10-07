# In Ordine V2 — functional audit

## Implemented and exercised in browser

- Separate Conti economici and Cose da fare sections; E.D.S. logo on the landing page and every route.
- Real balance changes only when an income is received or a payment is marked paid; scheduled entries affect the projection only.
- Income/payment creation, editing, deletion, category, supplier, status filters, month navigation, monthly totals and movement history.
- Monthly and yearly finance recurrence, including month-end and leap-day clamping.
- Monthly summary, comparison with the prior month, total budget and per-category limits.
- Todo create, edit, delete, complete, restore, month/year filters, chronological order, recurring dates and reminder settings.
- Profile, category management, appearance, date/text/accessibility preferences, data reset, backup export and backup restore.
- Capacitor Preferences, Local Notifications, Filesystem, Share and biometric plugins are imported through the V2 platform module and registered in the Android project.
- Android-safe viewport, dynamic height, edge spacing, flexible width and one V2 responsive stylesheet.

## Validation completed

- `npm run validate:v2`: all static, CSS, plugin wiring and JavaScript syntax checks pass.
- `npm run test:v2`: finance and Todo workflows, backup/restore and browser reload persistence pass.
- 21 routed screens checked at 360x800, 390x844, 412x915 and 430x932; no horizontal overflow, lateral shift or missing E.D.S. logo.
- Visual captures are real Chromium renders from the built V2 app, saved under `/tmp/in-ordine-v2-preview`.
- `npx cap sync android` registers the five native plugins and copies the V2 web build into the Android project.

## Native checks still requiring an Android device/build host

- Capacitor Preferences across an Android process kill/relaunch.
- Actual notification permission prompts, scheduled delivery and reboot behavior.
- Android biometric prompt and backup share/file-picker behavior.
- Physical status-bar/safe-area insets and device rendering.
- Gradle validation did not complete: this environment has Java 17 runtime but no `javac` compiler. No Android SDK is configured here. Compile and APK generation remain for an Android build host; APK creation is intentionally deferred until after visual review.
