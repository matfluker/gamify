# Gamify → iOS Native App (App Store Submission)

## How to Execute This Plan

### 1. Save this plan into the repo BEFORE the user switch

This file is currently at `/Users/artofdrawersllc/.claude/plans/i-want-to-make-pure-swing.md` — an internal harness path under the OLD macOS user. Once you log into the new user (`matfluker`), that path is no longer accessible. **Get the plan into the Gamify repo and push to GitHub before you switch users**, so the new account can pull it down:

```bash
# Run this WHILE still logged in as artofdrawersllc:
mkdir -p ~/Documents/Claude/Projects/Gamify/docs
cp ~/.claude/plans/i-want-to-make-pure-swing.md \
   ~/Documents/Claude/Projects/Gamify/docs/IOS_MIGRATION_PLAN.md
cd ~/Documents/Claude/Projects/Gamify
git add docs/IOS_MIGRATION_PLAN.md
git commit -m "Add iOS native migration plan"
git push
```

After the user switch (see Phase 0.5 below), you'll `git clone` Gamify under `matfluker` and the plan comes with it. The `gamify-native` repo will get its own copy of the plan during Phase 3.

### 2. Use VS Code (this environment) — NOT Claude Desktop

VS Code + the Claude Code extension you're using right now is the right tool. Claude Desktop is great for chat/research but doesn't have the file-editing, terminal, and IDE integration that this project needs. Stay in VS Code.

Open **two VS Code windows side by side** (paths shown under the new `matfluker` user):
- Window 1: `/Users/matfluker/Documents/Claude/Projects/Gamify` (existing web/backend repo) — used for Phases 1, 2, 2.5, 7 (privacy URLs)
- Window 2: `/Users/matfluker/Documents/Claude/Projects/gamify-native` (new iOS repo) — used for Phases 3-7

Each window gets its own Claude Code session, scoped to that repo.

### 3. Work phase by phase, not all at once

Don't open one giant Claude session and try to do all 8 phases. Each phase produces a checkpoint where you can verify things work, commit to git, and move on with a fresh context. Recommended cadence:

| Phase | Where | Session strategy |
|---|---|---|
| 0. Apple Dev / App Store Connect | Browser, not Claude | Just follow the steps; no code |
| 0.5. macOS user switch + workstation setup | New `matfluker` login + Terminal | Follow checklist in Phase 0.5 below; no Claude needed |
| 1. Schema migration | Gamify window | One Claude session: "Implement Phase 1 from docs/IOS_MIGRATION_PLAN.md" |
| 2. Backend endpoints | Gamify window | Break into sub-sessions: 2.1+2.2 (deps+env), then 2.3+2.4+2.5 (helpers+endpoints), then 2.6+2.7 (crons+vercel.json) |
| 2.5. Web regression | Gamify window | Manual browser test — no Claude needed |
| 3. Expo bootstrap | Terminal, then gamify-native window | Run `create-expo-app` yourself; then ask Claude to set up directory structure + app.config.js |
| 4. UI port | gamify-native window | **3-5 components per session.** Don't try all 21 at once — context bloats and quality drops |
| 5. Auth wiring | gamify-native window | One session for all three providers (they're tightly coupled) |
| 6. Push notifications | gamify-native window | One session, end-to-end |
| 7. Polish + assets | Both windows | Privacy/support URLs in Gamify; icons/screenshots in gamify-native |
| 8. TestFlight + submit | Terminal + browser | Just EAS commands + App Store Connect UI |

### 4. Each Claude session: open the plan + the relevant files first

Start each session by:
1. Opening `docs/IOS_MIGRATION_PLAN.md` in VS Code.
2. Telling Claude exactly which phase/section to implement (e.g. "Implement Phase 2.3 — the three new helper files in `api/_lib/`").
3. Letting Claude read the plan section itself rather than re-summarizing.

This keeps Claude grounded in the spec and avoids drift.

### 5. Commit early, commit often

After every working chunk (an endpoint, a screen, a feature), commit to git. If something breaks 2 hours later, you can `git diff` back to a known-good state. Example cadence:
- After Phase 1: commit (schema)
- After each helper file in Phase 2: commit
- After every 3-5 ported screens in Phase 4: commit
- After auth works end-to-end: commit + push + TestFlight build

### 6. Get to TestFlight EARLY

The single most valuable milestone is your first internal-tester build. As soon as Apple/Google sign-in works on a simulator, do `eas build --profile production` and install via TestFlight on your real iPhone. Everything from there gets more real:
- Push notifications can be tested (they don't work in the simulator)
- App Store icon/splash become visible
- Performance issues show up
- You'll feel which UI bits feel off and want a redesign before you've sunk more time into them

Don't wait until Phase 8. Aim for a TestFlight install by the end of Phase 5.

### 7. Useful Claude Code commands during this project

- `/init` — run once inside gamify-native after Phase 3 to generate a CLAUDE.md documenting the new project's conventions. Helps future sessions.
- `/review` — before each git commit, ask Claude to review your diff
- `/verify` — after a feature is wired up, ask Claude to run the app and confirm it works
- `/simplify` — once auth or push is working, run this to clean up before moving on

### 8. When you hit walls

Specific things that commonly trip people up — flag these to Claude immediately if you hit them:
- **Resend emails going to spam** → you need to verify your sending domain in Resend (add DKIM/SPF/DMARC DNS records). Resend's onboarding walks you through it.
- **APNs "BadDeviceToken"** → you likely have `APNS_PRODUCTION=false` but trying to send to a production-signed build (or vice versa). Match the env to the build.
- **Apple Sign In not appearing on real device** → the capability has to be enabled in BOTH the developer portal Bundle ID AND in `app.config.js` (`usesAppleSignIn: true`). Rebuild after toggling.
- **Google Sign In crashing** → 99% of the time, `iosUrlScheme` in `app.config.js` doesn't match the reversed-DNS form of your Google iOS client ID exactly.
- **Universal links not working** → skip them for v1 (see Phase 5.4). Not worth the time.

---

## Context

Gamify is a working web app: React 18 + Vite SPA on the frontend, Express on Vercel + Supabase Postgres on the backend. Users currently sign in by typing their phone number (no verification). Core mechanics: term/definition learning game with Daily Quiz (5Q), Daily Test (20Q), a Learn engine (MC → type-it-out → mastery), a 5-second-polling leaderboard, profile calendar/streak, share-code invites, and an onboarding tour.

The user wants a native iOS app (App Store) that is functionally identical and ready for submission. The native app will share the existing backend (one database, one API) so a user is the same person on web and on iOS. Phone-based identity is being retired on iOS in favor of free auth (Sign in with Apple, Sign in with Google, email magic code via Supabase + Resend). Phone-based web accounts can be linked to native accounts one-time via a "link your phone" step. The existing web app continues to function unchanged in this phase; a follow-up phase will migrate the web app to match.

Decisions locked:
- **Framework**: React Native + Expo (managed workflow).
- **Platform**: iOS only, forever.
- **Backend**: shared with web (same Vercel + Supabase).
- **Auth**: Sign in with Apple (primary), Sign in with Google, email magic code via Supabase + Resend. No SMS, no per-user cost.
- **Account deletion**: hard delete from inside the app (Apple 5.1.1(v)).
- **Code sharing**: utilities and config copied into `gamify-native` (no monorepo).
- **Push notifications**: daily quiz reminder, leaderboard pass, weekly streak danger.
- **Cron**: Vercel Cron Jobs.
- **Launch path**: TestFlight internal → App Store review.
- **Repo**: `gamify-native` already initialized on GitHub (empty).
- **Apple Developer**: Individual account, ready.
- **Monetization**: free, no IAP for v1.

The goal of this plan is the App Store going live with iOS v1. The web app stays untouched.

---

## Critical Files to Modify or Create

### Existing repo (Gamify/) — backend only, additive changes
- [schema.sql](schema.sql) — append additive ALTER TABLE + new `email_otp_codes` table.
- [api/_app.js](api/_app.js) — add new auth/push/cron endpoints; reuse `pickCanonicalUser` ([api/_app.js:46](api/_app.js#L46)), `mergeUserInto` ([api/_app.js:57](api/_app.js#L57)), `normalizePhone`, `easternDateString` (already imported there).
- [api/_lib/](api/_lib/) — add `appleAuth.js`, `apns.js`, `email.js`.
- [vercel.json](vercel.json) — add `crons` array.
- [package.json](package.json) — add `jose`, `google-auth-library`, `@parse/node-apn`, `resend`.
- New static routes for `/privacy`, `/support`, `/terms` (in [public/](public/) or as Vite routes).

### New repo (gamify-native/) — Expo app, full creation
- `app.config.js` — bundle ID, push entitlement, Apple Sign In plugin, Google iOS URL scheme.
- `src/api/client.js` — port of [src/api.js](src/api.js), but uses `expo-secure-store` instead of `localStorage`.
- `src/auth/{AppleSignIn,GoogleSignIn,EmailOtpFlow}.js`.
- `src/screens/auth/LoginScreen.js` — the three-auth-method screen (button hierarchy matters for Apple review).
- `src/screens/gameshell/GameShellTabs.js` — bottom tab navigator replacing the web sidebar.
- `src/push/registerForPushNotifications.js` — uses `getDevicePushTokenAsync`, NOT Expo's push token service.
- Copies of [src/utils/phone.js](src/utils/phone.js), [src/utils/similarity.js](src/utils/similarity.js), [src/utils/easternTime.js](src/utils/easternTime.js), [src/utils/tiers.js](src/utils/tiers.js), [src/config.js](src/config.js).

---

## Architecture Validation (settled before planning)

- **Shared backend is the right call.** `users.id` (UUID) is already the identity unit every other table foreign-keys to. Adding `apple_user_id`, `google_user_id`, `email` as additional lookup columns on the same row is purely additive.
- **Phone column nullable is safe.** Postgres allows multiple NULLs in a unique index, so iOS-only rows coexist with phone-based web rows.
- **The `X-User-Id` header pattern keeps working.** Every existing `/api/*` route reads `requireUser(req)` and doesn't care how the user logged in; new auth endpoints just return the same `{ user }` shape.
- **`@parse/node-apn`**, not the unmaintained `apn`. Both speak APNs HTTP/2 with .p8 token auth.
- **One known limitation kept for parity**: web client sends raw `user.id` and the server trusts it. iOS will do the same. Acknowledge in privacy policy. (Optional Phase 2.5 alt: switch `requireUser` to also verify a Supabase Auth JWT for iOS sessions — additive, won't break web.)

---

## Phase 0 — Apple Developer + App Store Connect Setup
*~2 hours · do first; these tasks run in parallel with code work*

1. **Bundle ID**: developer.apple.com → Identifiers → "+" → App ID → explicit `com.<yourdomain>.gamify`. Enable **Push Notifications** and **Sign In with Apple**.
2. **APNs Auth Key (.p8)**: Keys → "+" → enable Apple Push Notifications service. Download the .p8 (only available once — save to password manager). Record **Key ID** (10 chars) and **Team ID** (10 chars).
3. **Google Cloud Console**: console.cloud.google.com → new project "Gamify" → APIs & Services → Credentials → OAuth client ID → iOS → bundle ID matches step 1. Copy the **iOS client ID** and the reversed URL scheme.
4. **App Store Connect**: Apps → "+" → New App. Platform iOS, English (U.S.), Bundle ID from step 1, SKU `gamify-ios`. Add yourself as Internal Tester under TestFlight.

---

## Phase 0.5 — macOS User Switch + Workstation Setup
*~1-2 hours · one-time; do AFTER pushing the plan from the old user*

You're moving Gamify development from the `artofdrawersllc` macOS user to `matfluker`. This is a fresh workstation setup under the new user. Do it once, never again.

### Before logging out of `artofdrawersllc`
1. Confirm the plan is committed and pushed: `cd ~/Documents/Claude/Projects/Gamify && git status` — should be clean.
2. Confirm the **APNs .p8 file** is saved somewhere portable (password manager, 1Password, or AirDrop to yourself). You can only download it once from Apple Developer.
3. Confirm the Gamify `.env` file (with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) is also saved somewhere portable. `.env` is gitignored so it won't come down via clone.
4. Note your GitHub username and the SSH/HTTPS form you use for `git clone`.

### Log into `matfluker` and run this checklist

**a. Core dev tools** (skip any already installed system-wide):
```bash
# Xcode (full version, NOT just Command Line Tools — required for iOS builds)
# Install from App Store: https://apps.apple.com/app/xcode/id497799835
# After install, run once to accept license:
sudo xcodebuild -license accept
xcode-select --install   # extras

# Homebrew (if not present)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js (LTS 20+), git, gh CLI
brew install node@20 git gh
brew install --cask visual-studio-code

# Global npm tools
npm install -g eas-cli expo-cli
```

**b. Git config under the new user**:
```bash
git config --global user.name  "Mat Fluker"
git config --global user.email "mfluker@artofdrawers.com"

# Generate an SSH key for GitHub (or copy your existing one from a backup):
ssh-keygen -t ed25519 -C "mfluker@artofdrawers.com"
cat ~/.ssh/id_ed25519.pub   # add this to github.com/settings/keys

# Auth gh CLI:
gh auth login
```

**c. Clone both repos**:
```bash
mkdir -p ~/Documents/Claude/Projects
cd ~/Documents/Claude/Projects

git clone git@github.com:<your-github-user>/Gamify.git
# (plan is now at ~/Documents/Claude/Projects/Gamify/docs/IOS_MIGRATION_PLAN.md)

git clone git@github.com:<your-github-user>/gamify-native.git
```

**d. Restore Gamify `.env`**:
```bash
cd ~/Documents/Claude/Projects/Gamify
# Paste your saved Supabase creds:
cat > .env <<'EOF'
SUPABASE_URL=https://iuixpflmhcypcroiaoua.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
EOF
npm install
npm run dev   # confirm web app boots locally on http://localhost:5173
```

**e. Install Claude Code extension in VS Code under the new user**:
- Open VS Code → Extensions → search "Claude" → install
- Sign in with the same Anthropic account
- Open `~/Documents/Claude/Projects/Gamify` to verify the extension sees the repo

**f. Apple Developer access**:
Apple Developer credentials are tied to your **Apple ID**, not your Mac user account. Sign into developer.apple.com with the same Apple ID under `matfluker` — full access. Xcode → Settings → Accounts → "+" → add your Apple ID. Xcode will download certificates and provisioning profiles automatically when you start your first iOS build (Phase 8).

**g. Save APNs .p8 file**:
```bash
mkdir -p ~/.config/gamify
mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ~/.config/gamify/AuthKey.p8
chmod 600 ~/.config/gamify/AuthKey.p8
```
You'll paste its contents into Vercel as `APNS_KEY_P8` in Phase 2.2.

**h. Vercel access**:
```bash
npm install -g vercel
vercel login
cd ~/Documents/Claude/Projects/Gamify
vercel link   # links this repo to the existing Vercel project
```
Verify env vars are visible: `vercel env ls`.

**i. Supabase access**:
- Sign into supabase.com with the Google/email account that owns the existing project
- Confirm you can open the Gamify project's SQL Editor (you'll run Phase 1's migration here)

### Verification before moving on
- [ ] `cd ~/Documents/Claude/Projects/Gamify && npm run dev` starts both web and API locally
- [ ] You can open the web app, log in with your phone, see your existing data
- [ ] `gh repo view <your-user>/gamify-native` works
- [ ] Xcode opens without prompting for license acceptance
- [ ] VS Code's Claude extension is signed in
- [ ] `~/.config/gamify/AuthKey.p8` exists with correct mode
- [ ] `vercel env ls` shows `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

After this, the entire rest of the plan operates under `/Users/matfluker/...` paths.

---

## Phase 1 — Backend: Schema Migration
*~1 hour · all additions are idempotent and additive*

Append to [schema.sql](schema.sql):

```sql
alter table users alter column phone drop not null;

alter table users add column if not exists apple_user_id    text unique;
alter table users add column if not exists google_user_id   text unique;
alter table users add column if not exists email            text unique;
alter table users add column if not exists apns_device_token text;
alter table users add column if not exists notification_prefs jsonb
  not null default '{"daily": true, "passed": true, "streak": true}'::jsonb;
alter table users add column if not exists timezone         text;
alter table users add column if not exists deleted_at       timestamptz;
alter table users add column if not exists last_seen_at     timestamptz;

create index if not exists idx_users_email           on users(email)           where email is not null;
create index if not exists idx_users_apple_user_id   on users(apple_user_id)   where apple_user_id is not null;
create index if not exists idx_users_google_user_id  on users(google_user_id)  where google_user_id is not null;
create index if not exists idx_users_timezone_active on users(timezone)
  where deleted_at is null and apns_device_token is not null;

create table if not exists email_otp_codes (
  email       text not null,
  code_hash   text not null,         -- sha256(code) — never store plaintext
  expires_at  timestamptz not null,
  attempts    int not null default 0,
  created_at  timestamptz not null default now(),
  primary key (email)
);
create index if not exists idx_email_otp_expires on email_otp_codes(expires_at);
```

Run in Supabase SQL Editor. Then immediately do **Phase 2.5** (web regression test).

---

## Phase 2 — Backend: New Endpoints
*~12 hours · all in [api/_app.js](api/_app.js) plus three new helpers*

### 2.1 New dependencies — [package.json](package.json)
```
jose                ^5.9.6     # verify Apple identity token JWT
google-auth-library ^9.15.0    # verify Google ID token
@parse/node-apn     ^6.4.1     # send APNs pushes via HTTP/2
resend              ^4.0.1     # transactional email
```

### 2.2 Vercel env vars (Settings → Environment Variables)
```
APPLE_BUNDLE_ID            com.<yourdomain>.gamify
APPLE_TEAM_ID              <10-char>
GOOGLE_IOS_CLIENT_ID       <client>.apps.googleusercontent.com
APNS_KEY_ID                <10-char>
APNS_TEAM_ID               <10-char>
APNS_KEY_P8                <full .p8 contents, with literal \n between lines>
APNS_BUNDLE_ID             com.<yourdomain>.gamify
APNS_PRODUCTION            false           # flip to true after App Store approval
RESEND_API_KEY             re_xxx
RESEND_FROM                Gamify <noreply@your-verified-domain.com>
CRON_SECRET                <32-byte hex>
```

### 2.3 New helpers
**`api/_lib/appleAuth.js`** — verify Apple identity token JWT against `https://appleid.apple.com/auth/keys` using `jose`. Validate `iss`, `aud=APPLE_BUNDLE_ID`, `exp`. Returns the payload (`sub` is the stable Apple user ID).

**`api/_lib/apns.js`** — wraps `@parse/node-apn` Provider with .p8 token auth from env. Single export `sendPush(deviceToken, { title, body, data })`. On `BadDeviceToken`/`Unregistered` (status 410), caller should clear the token from DB.

**`api/_lib/email.js`** — wraps Resend. Single export `sendOtpEmail(to, code)`. Requires verified sending domain (DKIM/SPF/DMARC) — see Risk Register.

### 2.4 `findOrCreateUserByIdentity` (new function in [api/_app.js](api/_app.js))
Mirror of existing `findOrCreateUserByPhone` ([api/_app.js:140](api/_app.js#L140)). Looks up by `apple_user_id OR google_user_id OR email`. Three branches:
- 0 matches → insert new user with provided fields.
- 1 match → fill missing identifier columns (so a user who signed in with email last time and adds Apple now gets `apple_user_id` written); fill missing first/last name only (never overwrite).
- 2+ matches (same human via two providers separately) → reuse `pickCanonicalUser` + `mergeUserInto` logic; copy identifiers from dupes into canonical before deleting them.

### 2.5 New endpoints (all in [api/_app.js](api/_app.js))

```
POST  /api/auth/apple              { identityToken, firstName?, lastName? }  → { user }
POST  /api/auth/google             { idToken }                                → { user }
POST  /api/auth/email-otp/start    { email }                                  → { ok: true }
POST  /api/auth/email-otp/verify   { email, code, firstName?, lastName? }     → { user }
POST  /api/auth/link-phone         { phone }      [authed]                    → { user }   (may be merged canonical)
POST  /api/me/push-token           { apnsDeviceToken, timezone }  [authed]    → { ok: true }
DELETE /api/me/push-token          [authed]                                   → { ok: true }
PUT   /api/me/notification-prefs   { daily?, passed?, streak? }  [authed]     → { user }
POST  /api/me/delete               [authed]                                   → { ok: true }
POST  /api/cron/notifications/daily-quiz            [cron-secret]
POST  /api/cron/notifications/streak-danger         [cron-secret]
POST  /api/cron/notifications/leaderboard-changes   [cron-secret]
```

**Email OTP details**: 6-digit cryptographically random code, sha256-stored, 10-minute TTL, max 5 attempts, row deleted on success. Never reveal whether an email is known.

**Link-phone behavior**: if the entered phone belongs to an existing different user (the web account), call `mergeUserInto(iosUserId, webUserId)` — merge **iOS → web** so all web history (calendar, streak, points) is preserved on the canonical row. The web user's row absorbs the iOS user's auth identifiers. Return the canonical user; client replaces its `X-User-Id` with the new id.

**Account deletion**: `DELETE FROM users WHERE id = $current` — ON DELETE CASCADE handles memberships, points_ledger, learn_runs, quiz/test attempts, snapshots, activity log. Games where this user was admin will cascade-delete (which removes pairs too). This matches Apple's "hard delete" expectation.

### 2.6 Cron handlers
- `daily-quiz`: hourly. For each user where (now in their `timezone`) is 08:00 AND `notification_prefs.daily=true` AND `apns_device_token` is set AND no `activity_log` row for today — send "Your Daily Quiz is ready" push.
- `streak-danger`: hourly. For each user where (now in their tz) is Saturday 18:00 AND `notification_prefs.streak=true` AND 0 activity rows this Sun-Sat AND ≥1 activity last week — send "Your streak ends tonight" push.
- `leaderboard-changes`: every 10 min. Diff current ranks vs `last_notified_ranks` (new JSONB column on `games` — add to schema in 1.1 if not already). For every user who dropped rank, send "{newLeader} just passed you in {gameTitle}". Update column.

### 2.7 [vercel.json](vercel.json) additions
```json
"crons": [
  { "path": "/api/cron/notifications/daily-quiz",          "schedule": "0 * * * *" },
  { "path": "/api/cron/notifications/streak-danger",       "schedule": "0 * * * *" },
  { "path": "/api/cron/notifications/leaderboard-changes", "schedule": "*/10 * * * *" }
]
```
Cron handlers verify `x-vercel-cron` header per Vercel docs.

### 2.8 Smoke test each endpoint with curl before iOS app touches them
```
curl -X POST $BASE/api/auth/email-otp/start  -d '{"email":"you@x.com"}'
curl -X POST $BASE/api/auth/email-otp/verify -d '{"email":"you@x.com","code":"...","firstName":"M","lastName":"F"}'
```

---

## Phase 2.5 — Web Regression Test (MANDATORY)
*~30 minutes · before any iOS work*

After Phase 1 + 2 are deployed, run the full web app:
1. LoginScreen → enter your phone → land in existing game (no name re-prompt).
2. Daily Quiz → submit → points show on leaderboard.
3. Edit pairs as admin → confirm changes apply.
4. Open Learn → answer a few cards → exit → no crash.
5. In Supabase: confirm your existing row's `phone` is still set and new columns are NULL.

**If anything is broken, stop and fix.** This is the most important checkpoint.

---

## Phase 3 — gamify-native Expo Bootstrap
*~3 hours*

```
npx create-expo-app@latest gamify-native --template blank
cd gamify-native
git remote add origin git@github.com:<you>/gamify-native.git
```

Stay in JavaScript (web is JS — keeps things consistent).

### Dependencies
```
npx expo install \
  expo-apple-authentication expo-secure-store expo-notifications expo-device \
  expo-haptics expo-localization expo-splash-screen expo-status-bar expo-linking \
  react-native-safe-area-context react-native-screens react-native-pager-view \
  react-native-gesture-handler react-native-svg

npm install \
  @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack \
  @react-native-google-signin/google-signin
```

### Directory layout
```
gamify-native/
  app.config.js
  App.js
  assets/{icon.png,splash.png,adaptive-icon.png}
  src/
    api/client.js                # SecureStore-backed X-User-Id wrapper
    auth/{AppleSignIn,GoogleSignIn,EmailOtpFlow}.js
    config/index.js              # copied from web src/config.js
    utils/{phone,similarity,easternTime,tiers,haptics}.js
    components/{Monogram,TierIcon,Loading,SessionChart,DirectionPicker,...}.js
    screens/
      auth/{LoginScreen,EmailOtpScreen,LinkPhoneScreen}.js
      {GameHubScreen,CreateGameScreen,JoinGameScreen,InviteJoinScreen,OnboardingTour,SettingsScreen}.js
      gameshell/{GameShellTabs,ProfileTab,LeaderboardTab,QuizTab,TestTab,LearnTab,EditPairsModal}.js
    navigation/{RootNavigator,AuthNavigator,MainNavigator}.js
    push/{registerForPushNotifications,notificationHandlers}.js
    theme/{colors,spacing,typography}.js
```

### app.config.js (key fields)
```js
ios: {
  bundleIdentifier: 'com.<yourdomain>.gamify',
  buildNumber: '1',
  usesAppleSignIn: true,
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
    UIBackgroundModes: ['remote-notification'],
    NSUserNotificationUsageDescription:
      'Get reminded about your Daily Quiz and when friends pass you on the leaderboard.',
  },
  entitlements: { 'aps-environment': 'production' },
},
scheme: 'gamify',
plugins: [
  'expo-apple-authentication',
  ['expo-notifications', { color: '#000000' }],
  ['@react-native-google-signin/google-signin',
    { iosUrlScheme: 'com.googleusercontent.apps.<reversed-google-client-id>' }],
],
extra: {
  apiBase: process.env.EXPO_PUBLIC_API_BASE || 'https://<your-vercel>.vercel.app',
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
},
```

### `src/api/client.js`
Port of [src/api.js](src/api.js). Replace localStorage with `expo-secure-store`. Same `X-User-Id` header. Same `get/post/put/del` shape.

---

## Phase 4 — UI Port (component-by-component)
*~30 hours, days 6-10*

### Web → Native component map

| Web | Native | Notes |
|---|---|---|
| [LoginScreen.jsx](src/components/LoginScreen.jsx) | `screens/auth/LoginScreen.js` | Rewrite: three buttons — Apple (top, mandatory style), Google, Email. No phone input. |
| [CompleteProfile.jsx](src/components/CompleteProfile.jsx) | inline in LoginScreen / EmailOtpScreen | Apple gives name on first sign-in; Google gives it; email asks if missing. |
| [GameHub.jsx](src/components/GameHub.jsx) | `screens/GameHubScreen.js` | `<FlatList>` or `<ScrollView>` of games. |
| [CreateGame.jsx](src/components/CreateGame.jsx) | `screens/CreateGameScreen.js` | `<TextInput multiline>` replaces textareas. |
| [JoinGame.jsx](src/components/JoinGame.jsx) | `screens/JoinGameScreen.js` | Simple code input. |
| [InviteJoin.jsx](src/components/InviteJoin.jsx) | `screens/InviteJoinScreen.js` | Universal-link target (Phase 5.4). Logged-in path just calls `/api/games/join`. |
| [GameShell.jsx](src/components/GameShell.jsx) | `screens/gameshell/GameShellTabs.js` | Sidebar → bottom tab navigator. 5 tabs: Profile, Leaderboard, Quiz, Test, Learn. |
| [ProfileTab.jsx](src/components/ProfileTab.jsx) | `gameshell/ProfileTab.js` | Calendar = flex grid of `<View>`s. Streak rail = absolute-positioned views. SVG → react-native-svg. |
| [LeaderboardTab.jsx](src/components/LeaderboardTab.jsx) | `gameshell/LeaderboardTab.js` | Keep 5s polling. Pause when `AppState !== 'active'`. Web Share API → `Share.share`. |
| [QuizzesTab.jsx](src/components/QuizzesTab.jsx), [TestsTab.jsx](src/components/TestsTab.jsx), [QuizOrTest.jsx](src/components/QuizOrTest.jsx) | `gameshell/QuizTab.js`, `TestTab.js`, shared `QuizOrTest.js` | `Haptics.impactAsync(Light)` on pick, `notificationAsync(Success/Error)` on grade. |
| [LearnTab.jsx](src/components/LearnTab.jsx) | `gameshell/LearnTab.js` | Largest port. Same state machine. Animated.Value for green/red flashes. Haptics on correct/wrong. |
| [EditPairs.jsx](src/components/EditPairs.jsx) | `gameshell/EditPairsModal.js` | Full-screen modal via stack navigator. |
| [OnboardingTour.jsx](src/components/OnboardingTour.jsx) | `screens/OnboardingTour.js` | `react-native-pager-view` for swipable slides. Drop body-data-attribute spotlight tricks. |
| [InviteFriends.jsx](src/components/InviteFriends.jsx) | header button on LeaderboardTab | `Share.share({ url, message })`. |
| [Monogram.jsx](src/components/Monogram.jsx), [TierIcon.jsx](src/components/TierIcon.jsx), [SessionChart.jsx](src/components/SessionChart.jsx) | same names in `components/` | `react-native-svg` — paste path data verbatim, swap tag names. |
| [Loading.jsx](src/components/Loading.jsx) | `components/Loading.js` | `<ActivityIndicator>` or animated black circle with "G". |

### Styling
Do NOT port [src/styles.css](src/styles.css). Instead create `theme/{colors,spacing}.js` and per-component `StyleSheet.create({...})`. Match the look, not pixel-perfect — iOS users expect iOS conventions (large titles, system fonts, bottom tabs).

### Safe areas
`<SafeAreaProvider>` at app root. `useSafeAreaInsets()` on screens that need top/bottom padding. Test on iPhone 15 Pro Max + iPhone SE simulators.

### Haptics policy (`src/utils/haptics.js`)
```js
export const tap     = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const correct = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
export const wrong   = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
```
Wire `correct()`/`wrong()` into LearnTab's `commitAnswer` and QuizOrTest's grading branch.

---

## Phase 5 — Auth Wiring
*~12 hours, days 11-13*

### 5.1 Sign in with Apple
`expo-apple-authentication`. Use `<AppleAuthentication.AppleAuthenticationButton>` (mandatory style). On success, POST `{ identityToken, firstName?, lastName? }` to `/api/auth/apple`. Persist returned user via SecureStore.

### 5.2 Sign in with Google
`@react-native-google-signin/google-signin`. `GoogleSignin.configure({ iosClientId })` in app boot. On button tap: `signIn() → getTokens() → POST /api/auth/google { idToken }`.

### 5.3 Email magic code
Two-step screen: email → "Send code" → 6-digit input → if new user, prompt first/last name → done.

### 5.4 Universal links (defer to v1.1)
For v1, users enter share codes manually via JoinGame. Universal links (`/.well-known/apple-app-site-association` + `applinks:` entitlement + `expo-linking`) is a v1.1 task.

### 5.5 Link Phone (one-time prompt for new users)
After successful new-user sign-in, show:
> "Already use Gamify on the web? Enter your phone to link your account."
> [Phone field]  [Link account]  [Skip]

POST `/api/auth/link-phone { phone }`. If returned user has a different `id`, replace local user (server merged the iOS user into the web user). Set `linkPhonePrompted: true` in SecureStore so it never shows again.

### 5.6 Account deletion
`SettingsScreen` → "Delete Account" → confirmation modal → POST `/api/me/delete` → clear SecureStore → route to LoginScreen.

### 5.7 Apple button hierarchy (rejection-proofing)
Per Apple 4.8: Apple Sign In must be at least as prominent as Google. Use the same button size in the same column: **Apple on top, Google below, Email below that.**

---

## Phase 6 — Push Notifications
*~8 hours, days 14-15*

### 6.1 Token registration
Use `Notifications.getDevicePushTokenAsync()` — NOT `getExpoPushTokenAsync()` — because we send via our own APNs creds.
```js
const { data: apnsToken } = await Notifications.getDevicePushTokenAsync();
const timezone = Localization.timezone || 'America/New_York';
await api.post('/api/me/push-token', { apnsDeviceToken: apnsToken, timezone });
```
`expo-device` check `Device.isDevice` — simulator can't get tokens.

### 6.2 When to ask
Ask **after** the user completes onboarding AND finishes their first Daily Quiz. NOT on first launch.

### 6.3 Foreground handler + response handler
```js
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false })});
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  if (data?.gameId) { /* navigate to that game */ }
});
```

### 6.4 Settings toggles
SettingsScreen has 3 switches → `PUT /api/me/notification-prefs`.

---

## Phase 7 — Polish + Pre-Submit Assets
*~16 hours, days 16-18*

### Icons & splash
`assets/icon.png` 1024x1024 (no transparency, no rounded corners — Apple rounds for you). `assets/splash.png` 1284x2778. `adaptive-icon.png` for Android (unused but Expo wants it).

### URLs (host on existing Gamify web)
Add three static routes on the existing Vercel deployment:
- `/privacy` — what data we collect (name, email, Apple/Google IDs, push token, game activity), how it's used, deletion path, contact email.
- `/support` — short page with contact email.
- `/terms` — standard ToS.

### App Store Connect metadata
- Name "Gamify" (verify availability; fallback "Gamify Learn")
- Subtitle: "Daily quiz with friends" or similar
- Description (4000 char)
- Keywords (100 char)
- Category: Education primary, Games secondary
- Age Rating: 4+ (complete questionnaire)
- Privacy Policy URL, Support URL

### Privacy Nutrition Labels (App Privacy section)
| Data Type | Collected | Linked | Tracking | Purpose |
|---|---|---|---|---|
| Email Address | Yes | Yes | No | App functionality, account |
| Name | Yes | Yes | No | App functionality |
| User ID (Apple, Google) | Yes | Yes | No | App functionality |
| Phone Number (optional link) | Yes | Yes | No | App functionality |
| Game Score / Progress | Yes | Yes | No | App functionality |
| Device ID (APNs token) | Yes | Yes | No | Push notifications |

No third-party tracking. No analytics SDKs.

### Screenshots
6.7" iPhone (1290x2796), 3–10 required. Capture from iOS Simulator (iPhone 15 Pro Max) → Cmd+S. Suggested 5: Leaderboard, Daily Quiz mid-question, Learn mid-card, Profile with calendar/streak, LoginScreen (showing Apple Sign In).

---

## Phase 8 — TestFlight + Review
*Days 19-25*

### EAS Build setup
```
npm install -g eas-cli
eas login
eas init
eas build:configure
```
`eas.json`:
```json
{
  "build": {
    "production": { "ios": { "autoIncrement": "buildNumber" } }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "<your-apple-id>",
        "ascAppId": "<App-Store-Connect-app-id>",
        "appleTeamId": "<10-char>"
      }
    }
  }
}
```

### Build + upload
```
eas build --platform ios --profile production
eas submit --platform ios --latest
```
Wait ~10 min for processing in App Store Connect.

### TestFlight tests (PHYSICAL DEVICE — simulator can't push)
1. Apple Sign In end-to-end.
2. Google Sign In end-to-end.
3. Email OTP end-to-end (check spam).
4. Push permission grant after first quiz.
5. Manually trigger `daily-quiz` cron with curl + CRON_SECRET → push arrives.
6. Take a quiz, take a test, complete a learn session, view leaderboard.
7. Link phone to existing web account → web data appears.
8. Delete account → row + cascades gone → back to LoginScreen.
9. Background app on Leaderboard → reopen → polling resumes.
10. Force-quit → reopen → still signed in (SecureStore).

### Submit for App Store review
Provide demo credentials in App Review Information — easiest is a pre-seeded review email with a server-side fixed OTP code (e.g. `apple-review@<yourdomain>.com` → code `424242`), gated behind an env-var guard so it ONLY works for that one email.

Notes for reviewer:
> "Gamify is a learning game. Sign in with email `apple-review@<yourdomain>.com`; OTP `424242`. You'll see a sample game with Daily Quiz, Test, Learn, and Leaderboard. Account deletion is in Settings."

Review typically 24–48 hours. Common rejections pre-empted:
- **4.8**: Apple Sign In on top, same size as Google. ✓
- **5.1.1(v)**: Account deletion in Settings. ✓
- **4.0**: Native tabs + haptics + push + Apple Sign In + safe-area handling differentiate from web. ✓
- **2.3.10**: No "Android" mentions in marketing copy.
- **IDFA**: Select "No, not using IDFA."

---

## Verification

| Layer | How to verify | Pass criteria |
|---|---|---|
| Schema migration | Full web smoke test (Phase 2.5) | Every web flow still works |
| Apple auth | curl with real identityToken from device | Returns `{ user }` with `apple_user_id` set |
| Google auth | curl with idToken from `GoogleSignin.signIn` | Returns `{ user }` |
| Email OTP start | curl, check inbox | Email within 30s, no plaintext code in DB |
| Email OTP verify | curl with code | Returns `{ user }`; `email_otp_codes` row deleted |
| Link-phone (no conflict) | iOS user enters new phone | `users.phone` updated |
| Link-phone (merge) | iOS user enters web user's phone | iOS row merged into web row; web's `points_ledger`, `activity_log`, `memberships`, `learn_runs` preserved; iOS auth identifiers now on canonical row |
| Push registration | Real device after grant | `users.apns_device_token` populated |
| Daily quiz cron | Manual curl with CRON_SECRET | Push arrives on test device |
| Streak cron | Manual curl | Push arrives if conditions met |
| Leaderboard-changes cron | Score another user higher, wait 10 min | Push arrives |
| Account deletion | Settings → Delete → confirm | User row + all FK-cascaded rows gone in Supabase; app routes to LoginScreen |
| Backgrounded polling | LeaderboardTab → background → foreground | Polling resumes; no zombie timers |
| TestFlight install | Physical iPhone | All flows complete without crash |
| App Store submission | Submit | Approved on first try (target) |

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Schema migration breaks web | High | Phase 2.5 regression test before any iOS work; all changes additive |
| Resend domain not verified → emails to spam | Medium | Verify DKIM/SPF/DMARC before launch; keep Apple-only as fallback path |
| Apple rejects for "looks like a web app" | Medium | Bottom tabs + haptics + Apple Sign In + push + safe-area = clear native intent |
| Apple rejects for missing account deletion | Low | Verified working on TestFlight before submit |
| APNs token rotation/expiry | Medium | Re-register on every app launch; server clears bad tokens on 410 |
| Multi-account merge incorrectness on Link Phone | High | Reuses tested `mergeUserInto` helper; merge direction iOS→web; covered by manual test |
| Vercel cron Hobby limits | Low | 3 crons, ~600 invocations/day total — well under 12k/day cap |
| `X-User-Id` spoofable | Low for v1 | Disclosed in privacy policy; optional Supabase JWT add-on can be Phase 2.5 |
| Google OAuth iOS client mismatch | Low | Bundle ID must match exactly between Google Cloud Console and `app.config.js` |
| Apple first-vs-subsequent login data | Medium | Apple sends email/name only on FIRST sign-in. Backend MUST persist on first call and never expect them again. |
| Privacy nutrition labels mismatch reality | Medium | List every collected field including APNs token (Device ID category) |
| Universal links unset → invite friction | Low for v1 | Manual share-code entry works; defer universal links to v1.1 |

---

## Timeline

| Phase | Days | Effort |
|---|---|---|
| 0. Apple Dev / App Store Connect setup | 1 | 2h |
| 0.5. macOS user switch + workstation setup | 1 | 1-2h |
| 1. Schema migration | 1 | 1h |
| 2. Backend endpoints + helpers | 2-4 | 12h |
| 2.5. Web regression test | 4 | 0.5h |
| 3. Expo app bootstrap | 5 | 3h |
| 4. UI port | 6-10 | 30h |
| 5. Auth wiring | 11-13 | 12h |
| 6. Push notifications | 14-15 | 8h |
| 7. Polish + assets | 16-18 | 16h |
| 8. TestFlight + submit | 19-25 | spread |

Realistic total: **3-4 weeks** of focused work (accounting for TestFlight install cycles and review wait).
