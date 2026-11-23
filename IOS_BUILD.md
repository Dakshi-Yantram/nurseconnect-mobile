# NurseConnect iOS - build and release (Windows PowerShell)

The iOS app is the same Expo project and talks to the same backend
(https://api.nurseconnect.co.in), so existing accounts log in unchanged.
Bundle ID: `in.co.nurseconnect.partner` (same as the Android package).

## One-time setup

1. **Apple Developer Program** (paid, yearly). In App Store Connect create an app
   with bundle ID `in.co.nurseconnect.partner`.
2. **Firebase**: add an iOS app with that bundle ID, download `GoogleService-Info.plist`,
   put it in this folder (next to `app.config.js`). Without it the iOS build is refused.
   Alternative: `npx eas-cli env:create --name GOOGLE_SERVICES_PLIST --type file --environment production`
3. **APNs key** (Apple Developer -> Certificates, IDs & Profiles -> Keys -> new key with
   "Apple Push Notifications service"). Download the `.p8` once. Keep it out of git and chat.
   - Upload it in Firebase: Project settings -> Cloud Messaging -> Apple app configuration.
   - Put it on the backend server (below).
4. **Backend environment variables** (server settings only, no code change, then restart):
   - `APNS_KEY_P8` = contents or path of the .p8
   - `APNS_KEY_ID`, `APNS_TEAM_ID` = from the Apple Developer portal
   - `APNS_BUNDLE_ID` = `in.co.nurseconnect.partner`   (the default in code is a different id)
   - `APNS_USE_SANDBOX` = `false` for TestFlight / App Store

## Build and upload

```powershell
cd path\to\frontend
npm install
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

The first iOS build asks for your Apple ID and creates certificates and profiles for you.
Then install via TestFlight and test: login, booking, payment, photo upload, a call with the
app closed, and delete account.

## Before App Review
- Give reviewers a working demo login (same as Play Console "App access").
- Privacy policy URL: https://nurseconnect.co.in/privacy-policy
- iPhone screenshots only (the app is set to iPhone-only).
