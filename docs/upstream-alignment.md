# Upstream alignment

The current generated inventory is pinned to Wei-Shaw/sub2api commit
`b8dece9000c68815a5b867ca5a1e6f236e173905`.

## Native entry points

The sidebar and More Management page expose **Feature Center**. It groups the
management, user and public operations by module. Existing task-oriented screens
remain available; the feature center provides native operation forms for the
remaining request fields and operations. Account creation and system settings
link directly to their complete field forms.

- Path parameters are required and URL-encoded. Query filters support pagination
  and additional filters, including repeated query keys.
- Request fields come from the pinned Go request types, with TypeScript API
  definitions as a fallback. Strings, numbers, nullable fields and booleans have
  typed handling. Unset fields are omitted; false, zero and explicit empty strings
  are preserved. Nested objects and arrays use JSON inputs.
- Matching GET operations can load current configuration before an edit. Secret
  fields are not copied automatically. Mutations require an explicit confirmation.
- Lists and nested results are expandable. Record actions carry the selected ID
  into the next form. Large results and operation lists load incrementally.
- Plugin packages use multipart uploads. Raw JSON, text exports and completed SSE
  responses are accepted. The native QPS WebSocket can be connected/disconnected.
- Admin-key sessions cannot use JWT-only user operations. Requests are cancelled
  when leaving an operation or switching accounts; a late response cannot refresh
  credentials into the newly selected account.

The normal login screen supports password + TOTP, including remembered-account
login. Payment, OAuth, Passkey and browser verification use the login server's
official pages. Those pages have independent browser sessions. Their credentials
are never appended to links. A disabled `payment_enabled` hides the purchase
action behind an explanatory disabled button.

## What the inventory proves

The snapshot contains 442 management, 74 user and 60 public routes. The 442
management routes include the separate payment registration file and empty-group
channel monitor V2 registrations omitted by the older manifest generator.

Route availability is **not** the same as tested feature or UI parity. The audit
separates handwritten service integrations from generated wrappers and console
access. Native operation panels are not counted as bespoke, end-to-end workflows.
In particular, arbitrary plugin configuration remains a JSON editor, and plugin
supplied web UIs are not reproduced as native widgets. The inference gateway,
initial server deployment wizard and custom site HTML are not reimplemented here.

## Regeneration

Use one complete, commit-pinned local upstream checkout:

```sh
node .github/scripts/sync-sub2api-features.mjs .upstream-sub2api <commit-sha>
node .github/scripts/extract-upstream-api-metadata.mjs .upstream-sub2api
npm run generate:api-knowledge
npm run audit:api-coverage
npm run test:regressions
npx tsc --noEmit
```

Run these commands against the same pinned checkout. The existing scheduled
route-only workflow is unchanged; it does not refresh this complete feature
snapshot. Review schema changes; a new route in the catalog is not a claim that
its entire product workflow has been accepted.

## Verification status

Partially verified. Automated regressions cover settings-based API URLs, form
serialization, roles, multipart authentication refresh, cross-account response
isolation, native mutation confirmation, and the TOTP login sequence. Local Expo
Web checks exercise login, feature filtering, list reading and selected-record
forms using disposable fixture data. The provided deployment's public settings
have also been read using the actual application service and resolver.

Administrator/user end-to-end verification requires authenticated test sessions.
Payment and third-party authentication need their corresponding features enabled
on a test deployment. No production data has been modified as part of validation.
Physical iOS/Android verification and the plugin web UI bridge remain unverified.
