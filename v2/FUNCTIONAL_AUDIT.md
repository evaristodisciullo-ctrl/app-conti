# V2 functional audit

## Implemented
- Landing and separate Conti / Cose da fare areas
- Real balance and projected balance
- Income and payment creation, edit, delete, completion
- Completed-only movement history with type and month filters
- Month navigation
- Monthly and yearly financial recurrence
- Managed categories
- Monthly summary and previous-month comparison
- Monthly total budget and category limits
- Todo create, edit, delete, complete and restore
- Todo month/year filters and chronological ordering
- Monthly/yearly Todo recurrence
- Per-task reminder flag and native local notification scheduling
- Todo notification preferences
- Profile and appearance preferences
- Accessibility preferences
- Native-first persistence with browser fallback
- Backup export and restore
- Full data reset
- Optional native biometric protection
- Android safe-area responsive foundation

## Must pass before APK
- Static/module syntax validation
- Browser functional tests for finance and Todo flows
- Persistence after reload/reinitialization
- Responsive overflow tests at 360x800, 390x844, 412x915, 430x932
- Native Android build
- Visual preview review by the user

## Still to verify or refine
- Native plugin behavior on Android build/runtime
- Recurrence edge cases around month-end dates
- Notification behavior after Android restart
- Visual polish across all routes
- Exact behavior of backup sharing/restoration on device
