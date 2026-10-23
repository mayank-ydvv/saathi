import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../App";
import { createCognitoAuth, jwtClaims } from "./cognito";
import { createDemoAuth } from "./demo";
import { auth, authHeader, ensureFresh, getSession, setSession } from "./session";
import { AuthError } from "./types";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

/** A fake JWT with the given claims (unsigned: the browser only reads them). */
function jwt(claims: object) {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "none" })}.${b64(claims)}.sig`;
}

describe("Cognito client", () => {
  it("sends SignUp to the regional endpoint with the right target and body", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ CodeDeliveryDetails: { Destination: "p***@e***" } }), { status: 200 }),
    );
    const auth = createCognitoAuth("ap-south-1", "client123", fetchFn);
    const sent = await auth.signUp("priya@example.com", "secret123", "Priya");

    expect(sent.destination).toBe("p***@e***");
    const [url, init] = (fetchFn.mock.calls[0] ?? []);
    expect(url).toBe("https://cognito-idp.ap-south-1.amazonaws.com/");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-Amz-Target"]).toBe("AWSCognitoIdentityProviderService.SignUp");
    expect(headers["Content-Type"]).toBe("application/x-amz-json-1.1");
    expect(JSON.parse(String(init?.body))).toEqual({
      ClientId: "client123",
      Username: "priya@example.com",
      Password: "secret123",
      UserAttributes: [
        { Name: "email", Value: "priya@example.com" },
        { Name: "name", Value: "Priya" },
      ],
    });
  });

  it("turns an InitiateAuth result into a session with the name and email from the id token", async () => {
    const idToken = jwt({ email: "priya@example.com", name: "Priya" });
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ AuthenticationResult: { IdToken: idToken, AccessToken: "a", RefreshToken: "r", ExpiresIn: 3600 } }),
        { status: 200 },
      ),
    );
    const s = await createCognitoAuth("ap-south-1", "c", fetchFn).signIn("priya@example.com", "secret123");
    expect(s).toMatchObject({ email: "priya@example.com", name: "Priya", accessToken: "a", refreshToken: "r" });
    expect(JSON.parse(String(((fetchFn.mock.calls[0] ?? [])[1])?.body))).toMatchObject({
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: { USERNAME: "priya@example.com", PASSWORD: "secret123" },
    });
  });

  it("maps Cognito error types to AuthError codes", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ __type: "UserNotConfirmedException", message: "User is not confirmed." }), { status: 400 }),
    );
    await expect(createCognitoAuth("ap-south-1", "c", fetchFn).signIn("a@b.co", "x")).rejects.toMatchObject({
      code: "UserNotConfirmedException",
    });
  });

  it("reads JWT claims", () => {
    expect(jwtClaims(jwt({ email: "a@b.co" }))).toEqual({ email: "a@b.co" });
    expect(jwtClaims("not-a-jwt")).toEqual({});
  });
});

describe("demo auth", () => {
  it("needs the emailed code before logging in, then logs in", async () => {
    const auth = createDemoAuth();
    const sent = await auth.signUp("Priya@Example.com", "secret123", "Priya");
    expect(sent.demoCode).toMatch(/^\d{6}$/);
    await expect(auth.signIn("priya@example.com", "secret123")).rejects.toMatchObject({ code: "UserNotConfirmedException" });
    await expect(auth.confirmSignUp("priya@example.com", "000000")).rejects.toBeInstanceOf(AuthError);
    await auth.confirmSignUp("priya@example.com", sent.demoCode ?? "");
    const s = await auth.signIn("priya@example.com", "secret123");
    expect(s.name).toBe("Priya");
    await expect(auth.signIn("priya@example.com", "wrong1234")).rejects.toMatchObject({ code: "NotAuthorizedException" });
  });

  it("rejects weak passwords and resets a forgotten one", async () => {
    const auth = createDemoAuth();
    await expect(auth.signUp("a@b.co", "short", "A")).rejects.toMatchObject({ code: "InvalidPasswordException" });
    const first = await auth.signUp("a@b.co", "secret123", "A");
    await auth.confirmSignUp("a@b.co", first.demoCode ?? "");
    const reset = await auth.forgotPassword("a@b.co");
    await auth.confirmForgotPassword("a@b.co", reset.demoCode ?? "", "newpass99");
    expect((await auth.signIn("a@b.co", "newpass99")).email).toBe("a@b.co");
  });
});

describe("login gate", () => {
  beforeEach(() => setSession(null));

  it("sends a logged-out visitor to the login page", async () => {
    renderAt("/alerts");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("signs up, verifies with the code and lands on the dashboard after logging in", async () => {
    const user = userEvent.setup();
    renderAt("/signup");
    await user.type(screen.getByLabelText("Your name"), "Priya");
    await user.type(screen.getByLabelText("Email"), "priya@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    const shown = await screen.findByText(/Your code is/);
    const code = shown.textContent?.match(/\d{6}/)?.[0] ?? "";
    await user.type(screen.getByLabelText("Verification code"), code);
    await user.click(screen.getByRole("button", { name: "Verify email" }));

    expect(await screen.findByText("Email verified. You can log in now.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "priya@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: "Today's activity" })).toBeInTheDocument();
    expect(screen.getAllByText("priya@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Checking as/)[0]).toHaveTextContent("Checking as Priya");
  });

  it("shows a friendly error for a wrong password", async () => {
    const user = userEvent.setup();
    renderAt("/login");
    await user.type(screen.getByLabelText("Email"), "nobody@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
  });

  it("links the saathi mark back to the landing page", () => {
    renderAt("/login");
    expect(screen.getByRole("link", { name: "Saathi home page" })).toHaveAttribute("href", "http://localhost:5175");
  });
});

describe("session refresh (M9) and the API token (C1)", () => {
  const expired = {
    email: "priya@example.com",
    name: "Priya",
    idToken: "old",
    accessToken: "a",
    refreshToken: "r",
    expiresAt: Date.now() - 1000,
  };

  it("keeps the session when a refresh fails because the network is down", async () => {
    setSession(expired);
    vi.spyOn(auth, "refresh").mockRejectedValue(new AuthError("NetworkError"));
    expect(await ensureFresh()).toMatchObject({ email: "priya@example.com" });
    expect(getSession()).not.toBeNull();
  });

  it("signs out only when Cognito rejects the refresh token", async () => {
    setSession(expired);
    vi.spyOn(auth, "refresh").mockRejectedValue(new AuthError("NotAuthorizedException"));
    expect(await ensureFresh()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("sends a freshly renewed id token as the Authorization header", async () => {
    setSession(expired);
    vi.spyOn(auth, "refresh").mockResolvedValue({ ...expired, idToken: "new", expiresAt: Date.now() + 3600_000 });
    expect(await authHeader()).toEqual({ Authorization: "Bearer new" });
  });
});
