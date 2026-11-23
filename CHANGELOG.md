## iOS support
- app.config.js: iPhone-only, export-compliance flag, `aps-environment` driven by `APS_ENVIRONMENT`, Firebase files can come from EAS file variables; iOS cloud builds fail early if GoogleService-Info.plist is missing.
- eas.json: production profile auto-increments the iOS build number and builds for production APNs.
- plugins/withVoipPush.js: Swift AppDelegate now imports the VoIP push module.
- lib/call-push.ts: releases the PushKit completion handler after reporting the call to CallKit.
- components/RazorpayCheckout.tsx: iOS hands UPI / bank-app URL schemes to the OS.
- app/visit/rate/[id].tsx: Google Play review link shown on Android only.
- See IOS_BUILD.md.

# CHANGELOG: NurseConnect Android (branch nurseconnect-fixes)

Baseline: `baseline-original` = bb45c0c. Exported tip: 5529330. Not merged, pushed or deployed.

## Commits (newest first)
- `5529330` Mobile: bind offline queue to the signing-in account, drop foreign/expired items; disable app backup
- `c7bfcd3` Mobile: escape '<' '>' '&' in Razorpay WebView inline script options
- `cc63401` Android: optional real upload-key signing for local release builds
- `205b28f` Mobile: use IST slot start for the 6-hour cancellation cutoff
- `544232f` Mobile: forgiving date entry (auto-hyphen, / and no-separator input, calendar validation)

## Files changed vs baseline-original (A=added, M=modified, D=deleted)
- M  android/app/build.gradle
- M  android/app/src/main/AndroidManifest.xml
- M  app.config.js
- M  app/abha/link.tsx
- M  app/certificates.tsx
- M  app/edit-profile.tsx
- M  app/patients.tsx
- A  components/DateField.tsx
- M  components/RazorpayCheckout.tsx
- M  lib/booking-domain.ts
- A  lib/date-input.ts
- A  lib/offline-queue-policy.ts
- M  lib/offline-queue.ts
- A  lib/script-json.ts
- M  package.json
- A  scripts/booking-domain.test.mjs
- A  scripts/date-input.test.mjs
- A  scripts/offline-queue-policy.test.mjs
- A  scripts/script-json.test.mjs
- M  services/mappers.ts
- M  store/index.ts
