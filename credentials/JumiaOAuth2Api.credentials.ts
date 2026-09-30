import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  IDataObject,
  IHttpRequestHelper,
  INodeProperties,
} from "n8n-workflow";

/**
 * Jumia issues a client_id + refresh_token when you register your app.
 * Every time you use a refresh_token to get a new access_token, Jumia
 * ALSO rotates the refresh_token — the old one becomes invalid, and you
 * must store the new one for the next refresh.
 *
 * This credential type uses n8n's `preAuthentication` hook so the
 * refresh-and-persist logic runs automatically before every request
 * that uses this credential — no manual token handling needed in the
 * node code itself.
 */
export class JumiaOAuth2Api implements ICredentialType {
  name = "jumiaOAuth2Api";

  displayName = "Jumia OAuth2 API";

  documentationUrl =
    "https://vendorcenter.jumia.com/api-docs/#tag/Endpoints/operation/post-token";

  properties: INodeProperties[] = [
    {
      displayName: "Client ID",
      name: "clientId",
      type: "string",
      default: "",
    },
    {
      displayName: "Initial Refresh Token",
      name: "initialRefreshToken",
      type: "string",
      typeOptions: { password: true },
      default: "",
      description:
        "The refresh token Jumia gave you when the app was first registered. Only used the very first time this credential authenticates — after that, the rotated refresh token below takes over.",
    },
    // The following four fields are managed automatically by preAuthentication.
    // They start empty and get filled in / overwritten on every refresh.
    // NOTE: deliberately NOT type 'hidden' — some n8n versions don't
    // reliably persist preAuthentication's merged result into hidden
    // fields. Using masked 'string'/'number' fields instead, which is
    // the pattern n8n's own built-in preAuthentication nodes use

    // This commented out section was the original which was change because preAuthentication would not trigger with expirable is set to true
    //  {
    //   displayName: "Access Token (auto-managed — do not edit)",
    //   name: "accessToken",
    //   type: "string",
    //   typeOptions: { password: true },
    //   default: "",
    // },.
    {
      displayName: "Access Token (auto-managed — do not edit)",
      name: "accessToken",
      type: "hidden",
      typeOptions: { expirable: true },
      default: "",
    },
    {
      displayName: "Refresh Token (auto-managed — do not edit)",
      name: "refreshToken",
      type: "hidden",
      typeOptions: { expirable: true },
      default: "",
    },
    {
      displayName: "Expires At (auto-managed — do not edit)",
      name: "expiresAt",
      type: "hidden",
      default: 0,
    },
    {
      displayName: "Refresh Token Expires At (auto-managed — do not edit)",
      name: "refreshExpiresAt",
      type: "hidden",
      default: 0,
      description:
        "Tracks how long the current refresh_token itself is valid for (from refresh_expires_in). Useful for detecting a stalled workflow before the refresh token dies outright.",
    },
  ];

  // Attaches the cached access token to every request made with this credential.
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: {
      headers: {
        Authorization: "=Bearer {{$credentials.accessToken}}",
      },
    },
  };

  // Runs before each request. Returns only the fields that changed —
  // n8n merges them into the stored (encrypted) credential data.
  async preAuthentication(
    this: IHttpRequestHelper,
    credentials: IDataObject,
  ): Promise<IDataObject> {
    const bufferMs = 60 * 1000; // refresh 60s before actual expiry
    const now = Date.now();
    const currentExpiresAt = (credentials.expiresAt as number) || 0;

    const tokenStillValid =
      !!credentials.accessToken && now < currentExpiresAt - bufferMs;

    if (tokenStillValid) {
      // Nothing changed — return empty object so n8n doesn't touch stored data.
      return {};
    }

    // Use the current rotated refresh token if we have one; otherwise
    // fall back to the initial refresh token (first-ever run).
    const refreshTokenToUse =
      (credentials.refreshToken as string) ||
      (credentials.initialRefreshToken as string);

    if (!refreshTokenToUse) {
      throw new Error(
        'No refresh token available. Set "Initial Refresh Token" on this credential.',
      );
    }

    // "Self Authorization" grant — no client_secret involved, per Jumia's docs.
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: credentials.clientId as string,
      refresh_token: refreshTokenToUse,
    }).toString();

    let rawResponse: string | Record<string, unknown>;
    try {
      rawResponse = (await this.helpers.httpRequest({
        method: "POST",
        url: "https://vendor-api.jumia.com/token",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        // Critical: without this, n8n's httpRequest helper defaults to
        // json:true, which auto-serializes `body` as JSON and can
        // override our Content-Type header — silently corrupting this
        // already-URL-encoded string before it reaches Jumia.
        json: false,
      })) as string | Record<string, unknown>;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        "[Jumia][DEBUG] Token refresh request itself FAILED:",
        error,
      );
      throw error;
    }

    // eslint-disable-next-line no-console
    // console.log("[Jumia][DEBUG] Raw token response:", rawResponse);

    const response = (
      typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse
    ) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      refresh_expires_in: number;
    };

    // eslint-disable-next-line no-console
    console.log(
      "[Jumia][DEBUG] Parsed access_token present:",
      !!response.access_token,
      "| length:",
      response.access_token?.length,
      "| refresh_token present:",
      !!response.refresh_token,
    );

    const refreshExpiresAt = Date.now() + response.refresh_expires_in * 1000;

    // If the refresh token itself is close to expiring, something's wrong
    // upstream (workflow paused, credential not being used regularly, etc.)
    // — surface it loudly rather than silently going stale.
    if (refreshExpiresAt - Date.now() < 24 * 60 * 60 * 1000) {
      // eslint-disable-next-line no-console
      console.warn(
        "[Jumia] Refresh token expires in under 24h. If this credential stops being used, re-authorization via the Manage Applications UI will be required.",
      );
    }

    const toReturn = {
      accessToken: response.access_token,
      // Critical: persist the NEW refresh token. The old one is now dead.
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      refreshExpiresAt,
    };

    // eslint-disable-next-line no-console
    console.log(
      "[Jumia][DEBUG] Returning to n8n for credential merge — accessToken length:",
      toReturn.accessToken?.length,
    );

    return toReturn;
  }

  // Hits a real protected endpoint. Since this credential requires
  // preAuthentication to attach a valid token, n8n runs the refresh
  // flow before sending this test request — so clicking Save/Test
  // actually fetches and persists a token, and shows you a genuine
  // "Connection tested successfully" or a real error, not a no-op.
  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://vendor-api.jumia.com",
      url: "/orders",
      method: "GET",
      qs: { size: 1 },
    },
  };
}
