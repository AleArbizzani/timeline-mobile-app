# TestFlight Submission Guide for timeline-app

This guide walks you through submitting your Expo app to Apple TestFlight for beta testing.

---

## Prerequisites (what you need before starting)

1. **Expo account** (free)  
   - Sign up at [expo.dev/signup](https://expo.dev/signup) if you don't have one.

2. **Paid Apple Developer account** ($99/year)  
   - Sign up at [developer.apple.com](https://developer.apple.com/account/).  
   - TestFlight only works with a **paid** account, not a free one.

3. **Apple ID with 2FA**  
   - Your Apple ID must have two-factor authentication enabled.

---

## Option A: Simplest path – `npx testflight`

This single command builds, signs, and submits your app to TestFlight. It’s fully interactive.

### Step 1: Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```

### Step 2: Run TestFlight

```bash
npx testflight
```

The wizard will ask you to:

- Sign in to your Apple Developer account (Apple ID + 2FA code)
- Confirm or enter the bundle identifier (default: `com.timeline.app`)
- Answer whether your app uses standard or exempt encryption
- Create or reuse distribution certificates and provisioning profiles
- Set up or verify your App Store Connect API key

The build runs on Expo’s servers (no Xcode on your Mac required). When it finishes, the IPA is submitted to App Store Connect and appears in TestFlight.

---

## Option B: Step-by-step (build, then submit)

Use this if you want more control or prefer separate build and submit steps.

### Step 1: Configure EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Step 2: Build for iOS

```bash
eas build --platform ios --profile production
```

### Step 3: Submit to TestFlight

After the build completes:

```bash
eas submit --platform ios --latest
```

Or build and submit in one go:

```bash
eas build --platform ios --profile production --auto-submit
```

---

## After submission

1. Open [App Store Connect](https://appstoreconnect.apple.com/)
2. Go to **My Apps** → select your app
3. Open the **TestFlight** tab
4. Wait a few minutes for Apple to process the build
5. Add internal testers (team members with access to your App Store Connect account)
6. Optionally add external testers (requires a short review)

---

## Customizing the bundle identifier

The app is currently configured with:

- `app.timelinecoach.timeline`

To use your own (e.g. `com.yourcompany.timelineapp`):

1. Update `app.json` → `expo.ios.bundleIdentifier`
2. This must stay unique across all apps on the App Store.

---

## Creating the app on App Store Connect

If you haven’t created the app yet, you can do it during `eas submit` or `npx testflight`, or beforehand:

1. Go to [App Store Connect](https://appstoreconnect.apple.com/) → **My Apps**
2. Click the **+** button → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: timeline-app (or your preferred name)
   - **Primary language**
   - **Bundle ID**: select the one that matches `app.timelinecoach.timeline` (or the ID you configured)
   - **SKU**: any unique string (e.g. `timeline-app-001`)

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| "No credentials" | Run `eas credentials --platform ios` and follow the prompts |
| "Bundle ID not found" | Create the app in App Store Connect with the same bundle ID |
| 2FA issues | Use an App Store Connect API key instead (EAS can help create it) |
| Build fails | Check the build logs on [expo.dev](https://expo.dev) → your project → Builds |

---

## Quick start checklist

- [ ] Expo account
- [ ] Paid Apple Developer account
- [ ] Run `npm install -g eas-cli && eas login`
- [ ] Run `npx testflight`
- [ ] Sign in with Apple ID when prompted
- [ ] Add testers in App Store Connect → TestFlight
