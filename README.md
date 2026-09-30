# n8n-nodes-jumia

Custom n8n community node for the Jumia Vendor API, with automatic
access-token refresh using Jumia's **rotating refresh token** flow.

## How the token rotation works

Jumia's flow:
1. You register your app and get a `client_id` + an initial `refresh_token`.
2. Exchanging a refresh token for an access token also returns a **new**
   refresh token — the one you used is now invalid.
3. So every refresh must **persist the new refresh token**, or the next
   refresh attempt will fail.

This package handles that with n8n's `preAuthentication` hook on the
credential type (`JumiaOAuth2Api.credentials.ts`):

- Before every API call, it checks if the cached access token is expired
  (or about to expire, with a 60s buffer).
- If so, it calls Jumia's token endpoint using the **currently stored**
  refresh token (falling back to the initial one on first run).
- It returns the new `accessToken`, `refreshToken`, and `expiresAt` —
  n8n automatically merges these into the encrypted credential and
  persists them, so the next execution (even in a different workflow)
  picks up the latest rotated token.

You don't need any manual refresh logic in the node itself — every node
that uses the `jumiaOAuth2Api` credential gets this for free.

## Token endpoint (confirmed against Jumia's docs)

- Endpoint: `POST https://vendor-api.jumia.com/token`
- Content type: `application/x-www-form-urlencoded`
- Request fields: `grant_type=refresh_token`, `client_id`, `refresh_token`
  (no `client_secret` — this is the "Self Authorization" flow, distinct
  from the Web Application/authorization_code flow which never receives
  a refresh token at all)
- Response fields: `access_token`, `refresh_token`, `expires_in`,
  `refresh_expires_in`

The code also tracks `refresh_expires_in` and logs a warning if the
refresh token itself is within 24h of expiring — a sign the credential
hasn't been used recently and may need re-authorizing from the Manage
Applications screen in Jumia's vendor UI.

The example `Jumia.node.ts` only implements a placeholder "Get Order" /
"Get Many Orders" operation to prove the credential wiring works end to
end. Add whatever resources/operations (products, orders, returns, etc.)
you actually need.

## Build & install (self-hosted n8n)

```bash
npm install
npm run build
```

Then either:
- Publish to npm and install via n8n's **Settings → Community Nodes**, or
- For local dev: symlink or copy the built package into your n8n instance's
  custom nodes directory (`~/.n8n/custom/` by default) and restart n8n.

## Setting up the credential

In n8n, create a new **Jumia OAuth2 API** credential:
- `Client ID`: from your Jumia app registration
- `Initial Refresh Token`: the refresh token Jumia gave you at registration

Leave the auto-managed fields (Access Token, Refresh Token, Expires At,
Refresh Token Expires At) empty — the node fills them in on first use and
keeps them updated.

There's no "Test" button behavior on this credential (n8n's built-in
credential tester doesn't run `preAuthentication` first, so it can't
exercise the refresh flow correctly). Verify a new credential by running
the Jumia node once instead.

## Caveat

This relies on n8n's credential store being writable from
`preAuthentication` (standard in modern n8n, self-hosted or cloud). If
you're on an older n8n version that doesn't support `preAuthentication`,
you'd need to fall back to manual token handling inside the node's
`execute()` method plus n8n's REST API to persist credential updates.
