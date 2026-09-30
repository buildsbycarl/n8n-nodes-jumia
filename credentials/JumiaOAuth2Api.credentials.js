"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JumiaOAuth2Api = void 0;
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
var JumiaOAuth2Api = /** @class */ (function () {
    function JumiaOAuth2Api() {
        this.name = "jumiaOAuth2Api";
        this.displayName = "Jumia OAuth2 API";
        this.documentationUrl = "https://vendorcenter.jumia.com/api-docs/#tag/Endpoints/operation/post-token";
        this.properties = [
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
                description: "The refresh token Jumia gave you when the app was first registered. Only used the very first time this credential authenticates — after that, the rotated refresh token below takes over.",
            },
            // The following four fields are managed automatically by preAuthentication.
            // They start empty and get filled in / overwritten on every refresh.
            // NOTE: deliberately NOT type 'hidden' — some n8n versions don't
            // reliably persist preAuthentication's merged result into hidden
            // fields. Using masked 'string'/'number' fields instead, which is
            // the pattern n8n's own built-in preAuthentication nodes use.
            {
                displayName: "Access Token (auto-managed — do not edit)",
                name: "accessToken",
                type: "string",
                typeOptions: { password: true },
                default: "",
            },
            {
                displayName: "Refresh Token (auto-managed — do not edit)",
                name: "refreshToken",
                type: "string",
                typeOptions: { password: true },
                default: "",
            },
            {
                displayName: "Expires At (auto-managed — do not edit)",
                name: "expiresAt",
                type: "number",
                default: 0,
            },
            {
                displayName: "Refresh Token Expires At (auto-managed — do not edit)",
                name: "refreshExpiresAt",
                type: "number",
                default: 0,
                description: "Tracks how long the current refresh_token itself is valid for (from refresh_expires_in). Useful for detecting a stalled workflow before the refresh token dies outright.",
            },
        ];
        // Attaches the cached access token to every request made with this credential.
        this.authenticate = {
            type: "generic",
            properties: {
                headers: {
                    Authorization: "=Bearer {{$credentials.accessToken}}",
                },
            },
        };
        // Hits a real protected endpoint. Since this credential requires
        // preAuthentication to attach a valid token, n8n runs the refresh
        // flow before sending this test request — so clicking Save/Test
        // actually fetches and persists a token, and shows you a genuine
        // "Connection tested successfully" or a real error, not a no-op.
        this.test = {
            request: {
                baseURL: "https://vendor-api.jumia.com",
                url: "/orders",
                method: "GET",
                qs: { size: 1 },
            },
        };
    }
    // Runs before each request. Returns only the fields that changed —
    // n8n merges them into the stored (encrypted) credential data.
    JumiaOAuth2Api.prototype.preAuthentication = function (credentials) {
        return __awaiter(this, void 0, void 0, function () {
            var bufferMs, now, currentExpiresAt, tokenStillValid, refreshTokenToUse, body, rawResponse, response, refreshExpiresAt;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        bufferMs = 60 * 1000;
                        now = Date.now();
                        currentExpiresAt = credentials.expiresAt || 0;
                        tokenStillValid = !!credentials.accessToken && now < currentExpiresAt - bufferMs;
                        if (tokenStillValid) {
                            // Nothing changed — return empty object so n8n doesn't touch stored data.
                            return [2 /*return*/, {}];
                        }
                        refreshTokenToUse = credentials.refreshToken ||
                            credentials.initialRefreshToken;
                        if (!refreshTokenToUse) {
                            throw new Error('No refresh token available. Set "Initial Refresh Token" on this credential.');
                        }
                        body = new URLSearchParams({
                            grant_type: "refresh_token",
                            client_id: credentials.clientId,
                            refresh_token: refreshTokenToUse,
                        }).toString();
                        return [4 /*yield*/, this.helpers.httpRequest({
                                method: "POST",
                                url: "https://vendor-api.jumia.com/token",
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded",
                                },
                                body: body,
                                // Critical: without this, n8n's httpRequest helper defaults to
                                // json:true, which auto-serializes `body` as JSON and can
                                // override our Content-Type header — silently corrupting this
                                // already-URL-encoded string before it reaches Jumia.
                                json: false,
                            })];
                    case 1:
                        rawResponse = (_a.sent());
                        response = (typeof rawResponse === "string" ? JSON.parse(rawResponse) : rawResponse);
                        refreshExpiresAt = Date.now() + response.refresh_expires_in * 1000;
                        // If the refresh token itself is close to expiring, something's wrong
                        // upstream (workflow paused, credential not being used regularly, etc.)
                        // — surface it loudly rather than silently going stale.
                        if (refreshExpiresAt - Date.now() < 24 * 60 * 60 * 1000) {
                            // eslint-disable-next-line no-console
                            console.warn("[Jumia] Refresh token expires in under 24h. If this credential stops being used, re-authorization via the Manage Applications UI will be required.");
                        }
                        return [2 /*return*/, {
                                accessToken: response.access_token,
                                // Critical: persist the NEW refresh token. The old one is now dead.
                                refreshToken: response.refresh_token,
                                expiresAt: Date.now() + response.expires_in * 1000,
                                refreshExpiresAt: refreshExpiresAt,
                            }];
                }
            });
        });
    };
    return JumiaOAuth2Api;
}());
exports.JumiaOAuth2Api = JumiaOAuth2Api;
