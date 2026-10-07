# In Ordine V2

Android-first rebuild. The active app is implemented in `v2/` and packaged into `www/` with `npm run build:v2`; Capacitor uses that output as its Android web layer.

## Local development

- `npm ci`
- `npm run build:v2`
- `npm run validate:v2`
- `npm run test:v2`
- `npx cap sync android`

The V2 functional test launches a browser against the built app, checks finance and Todo flows, persistence after reload, and the requested phone viewport sizes. It captures actual rendered screens under `/tmp/in-ordine-v2-preview`.
