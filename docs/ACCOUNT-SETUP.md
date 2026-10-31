# Frost account setup — pending deployment

The account backend is in development. These files prepare Google configuration; they do not enable authentication on the live site. Existing TOTP enrollment stays on the isolated admin origin.

## Google Form

1. Create an owner-controlled Google Form with one required short-answer question named **Frost verification code**. Do not rename that question after installing the script.
2. Under Settings → Responses, choose **Collect email addresses: Verified**. A respondent-entered email question does not verify an identity. Keep response editing off. Do not limit the Form to one response per person, because interrupted registrations need to retry.
3. Set a confirmation message telling the user to return to their Frost registration tab. Google Forms does not automatically redirect to Frost.
4. Record the public responder `viewform` URL in `FROST_FORM_URL`. No pre-filled link or entry ID is needed: visitors paste the displayed site code manually. `FROST_FORM_ID` is the editor/API Form ID, not the public publication ID.
5. Create an Apps Script project owned by you. Copy `platform/google-form/Code.gs` and `appsscript.json`. Connect a Google Cloud project with the Google Forms API enabled.
6. In Script Properties, set `FROST_FORM_ID`, the assigned `FROST_DISPENSER_ORIGIN`, and `FROST_FORMS_SECRET`. The webhook secret must match the account service secret. Never put it in a Form question, browser code, chat, or source control.
7. Run `installFrostTriggers` and authorize it. It checks the Form API's VERIFIED setting before installing triggers. The submit handler checks it again before accepting a Google-provided respondent email. No send-mail permission is needed; Frost sends no emails.

Failed deliveries retry every five minutes for up to twenty minutes; registration itself expires after fifteen minutes. The original registration page polls for completion with a private HttpOnly cookie. Verification events are signed and idempotent. Pending email data is removed from Script Properties after delivery or expiry. Google Forms retains its own responses: configure and follow an owner response-deletion policy there too.

## Returning users and expired sign-ins

Frost does not use Google OAuth sign-in. No visitor OAuth client ID, client secret or callback URI is needed. The owner script uses an owner-only testing authorization profile. The owner's Apps Script still needs Google's normal authorization to read the Form and deliver signed verification events; visitors do not grant OAuth access to Frost.

The owner requested site-generated codes with no outgoing email and no visitor OAuth. Frost displays a one-time code which the user manually pastes into the Google Form. A signed Apps Script event must match both this code and the pending Google-verified email. The original dispenser browser completes using its separate private HttpOnly polling cookie. Requests expire after fifteen minutes and complete once; returning verification preserves the Frost ID. Restricted accounts remain appeals-only. Forwarding a code to another person can still authorize the initiating browser: this social-engineering limitation is not solved by the polling cookie. Live integration and deployment remain pending.

Reverification restores the existing Frost ID and account data. It never creates a new account for a returning email. Banned or suspended users can reverify to access support and appeals, but cannot browse or access the saved-cookie vault. Changing email uses the same Form verification, bound to the current account/device, then invalidates existing sessions.

## Sessions, saves and restrictions

Device grants do not have an inactivity timeout. Access credentials expire after fifteen minutes and are renewed with rotating, hashed refresh credentials. Browser cookies have a maximum lifetime and renew on use; clearing site data or browser-imposed expiration still requires signing in again. Logout, device revocation, account deletion and bans invalidate grants server-side.

The account vault encrypts current tabs and website cookies with a separate AES-256-GCM key. It excludes browsing history and page content. Websites may still expire their own sessions. Losing the encryption key loses access to saved vault contents; back it up outside Git. Conflicting device saves return a conflict instead of silently overwriting newer data.

Banned and suspended users must be sent to `/appeal` on the dispenser. They can sign in there to submit an appeal, but cannot browse or access the vault. Deleting a restricted account retains a keyed, non-reversible identity restriction so deletion cannot bypass a ban. The owner must be able to clear this record explicitly on appeal.

Do not enable cookie synchronization before the browser-content isolation migration and security checks pass. The current live engine shares the main origin. Remaining release work includes the trusted shell/runtime boundary, dispenser UI and infrastructure, actual owner configuration, integration tests, independent review and deployment verification.

## Form configuration checkpoint

The owner Form `173OvEpu6bqDcWHVrsqFyYCo1Gn6hVc0dF7bc_OLa2K4` is configured with a required short-answer Frost verification code question and Verified email collection. Response copies, response editing, and one-response limits are off. The confirmation instructs visitors to return to their original dispenser tab. The Form is published and connected to the isolated account backend at https://d3mbml114oiqni.cloudfront.net. Both triggers are installed; verifyFrostConnection passed against the live signed endpoint. Real user signup verification remains pending.

## Isolated dispenser deployment

Generate the reviewed package with `node scripts/build-platform.mjs`. Upload `.project-memory/platform-deploy/deployment.zip` to AWS CloudShell in us-east-1, extract into a dedicated directory, and run `bash deploy.sh`. The target is the new `frost-accounts` stack, not the existing `frost-admin` stack. Initial registration and the scheduled monitor remain disabled. The CloudShell helper keeps original keys in a private owner file; securely back up that file. Never replace missing keys on an existing stack.

Rollback before activation: keep registration disabled and leave main browsing unchanged. Preserve the retained DynamoDB table and original encryption/signing keys. For later code rollback use the previous content-addressed S3 code key; never delete account data as part of rollback. Verify direct Lambda denial, signed POSTs, cookie forwarding, real transactions and the Form submission before activation. The monitor requires a longer worker timeout before enabling multiple endpoint probes.
