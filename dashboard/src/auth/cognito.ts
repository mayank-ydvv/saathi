/**
 * Amazon Cognito user-pool auth over its public JSON API (no SDK): every call is a POST to
 * https://cognito-idp.<region>.amazonaws.com/ with an `X-Amz-Target` header. These operations
 * need only the app client id (no AWS credentials). Cognito sends the verification and reset
 * emails itself. O(1) per call.
 */
import { AuthError, type AuthErrorCode, type AuthProvider, type CodeDelivery, type Session } from "./types";

type Json = Record<string, unknown>;

const KNOWN = new Set<string>([
  "UsernameExistsException",
  "UserNotConfirmedException",
  "NotAuthorizedException",
  "CodeMismatchException",
  "ExpiredCodeException",
  "InvalidPasswordException",
  "InvalidParameterException",
  "LimitExceededException",
  "TooManyRequestsException",
  "UserNotFoundException",
]);

/** Reads the claims of a JWT without verifying it (the browser only needs email/name/exp). */
export function jwtClaims(token: string): Json {
  const part = token.split(".")[1] ?? "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Json;
  } catch {
    return {};
  }
}

function delivery(body: Json, fallback: string): CodeDelivery {
  const d = (body.CodeDeliveryDetails ?? {}) as Json;
  return { destination: typeof d.Destination === "string" ? d.Destination : fallback };
}

export function createCognitoAuth(region: string, clientId: string, fetchFn: typeof fetch = fetch): AuthProvider {
  const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;

  async function call(target: string, payload: Json): Promise<Json> {
    let res: Response;
    try {
      res = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
        },
        body: JSON.stringify({ ClientId: clientId, ...payload }),
      });
    } catch {
      throw new AuthError("NetworkError");
    }
    const body = ((await res.json().catch(() => ({}))) ?? {}) as Json;
    if (!res.ok) {
      // __type looks like "UsernameExistsException" or "...#UsernameExistsException".
      const type = String(body.__type ?? "").split("#").pop() ?? "";
      const code = (KNOWN.has(type) ? type : "Unknown") as AuthErrorCode;
      throw new AuthError(code, typeof body.message === "string" ? body.message : undefined);
    }
    return body;
  }

  function toSession(result: Json, refreshToken: string): Session {
    const idToken = String(result.IdToken ?? "");
    const claims = jwtClaims(idToken);
    const email = String(claims.email ?? "");
    return {
      email,
      name: String(claims.name ?? "") || email.split("@")[0] || "Family",
      idToken,
      accessToken: String(result.AccessToken ?? ""),
      refreshToken: String(result.RefreshToken ?? refreshToken),
      expiresAt: Date.now() + Number(result.ExpiresIn ?? 3600) * 1000,
    };
  }

  return {
    mode: "cognito",
    async signUp(email, password, name) {
      const body = await call("SignUp", {
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name },
        ],
      });
      return delivery(body, email);
    },
    async confirmSignUp(email, code) {
      await call("ConfirmSignUp", { Username: email, ConfirmationCode: code });
    },
    async resendCode(email) {
      return delivery(await call("ResendConfirmationCode", { Username: email }), email);
    },
    async signIn(email, password) {
      const body = await call("InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: password },
      });
      return toSession((body.AuthenticationResult ?? {}) as Json, "");
    },
    async refresh(session) {
      const body = await call("InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        AuthParameters: { REFRESH_TOKEN: session.refreshToken },
      });
      return toSession((body.AuthenticationResult ?? {}) as Json, session.refreshToken);
    },
    async forgotPassword(email) {
      return delivery(await call("ForgotPassword", { Username: email }), email);
    },
    async confirmForgotPassword(email, code, newPassword) {
      await call("ConfirmForgotPassword", { Username: email, ConfirmationCode: code, Password: newPassword });
    },
    async signOut(session) {
      // GlobalSignOut takes the access token instead of the client id.
      try {
        await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.GlobalSignOut",
          },
          body: JSON.stringify({ AccessToken: session.accessToken }),
        });
      } catch {
        // Offline: the local session is cleared anyway.
      }
    },
  };
}
