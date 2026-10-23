/**
 * Demo auth for local runs and tests, used when no Cognito client id is configured. It follows
 * the same rules as the real user pool (verify before login, 8+ chars with a number, codes
 * expire) but keeps accounts in this browser's localStorage and returns the code instead of
 * emailing it, so the screens can show it. Never used once VITE_COGNITO_CLIENT_ID is set.
 */
import { AuthError, type AuthProvider, type Session } from "./types";

type DemoUser = { name: string; hash: string; verified: boolean; code?: string; codeExpires?: number };

const KEY = "saathi.demoUsers";
const CODE_TTL_MS = 24 * 3600 * 1000;

function load(): Record<string, DemoUser> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, DemoUser>;
  } catch {
    return {};
  }
}

function save(users: Record<string, DemoUser>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(users));
  } catch {
    // private mode: accounts last for this page only
  }
}

async function hash(password: string): Promise<string> {
  const data = new TextEncoder().encode(`saathi-demo:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function checkPassword(password: string): void {
  if (password.length < 8 || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new AuthError(
      "InvalidPasswordException",
      "Use at least 8 characters, with a lowercase letter and a number.",
    );
  }
}

function newCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function issue(users: Record<string, DemoUser>, email: string) {
  const user = users[email];
  if (!user) throw new AuthError("UserNotFoundException");
  user.code = newCode();
  user.codeExpires = Date.now() + CODE_TTL_MS;
  save(users);
  return { destination: email, demoCode: user.code };
}

function consumeCode(user: DemoUser | undefined, code: string) {
  if (!user || !user.code) throw new AuthError("CodeMismatchException");
  if ((user.codeExpires ?? 0) < Date.now()) throw new AuthError("ExpiredCodeException");
  if (user.code !== code.trim()) throw new AuthError("CodeMismatchException");
  delete user.code;
  delete user.codeExpires;
}

function session(email: string, name: string): Session {
  const token = `demo.${btoa(email)}.${Date.now()}`;
  return { email, name, idToken: token, accessToken: token, refreshToken: token, expiresAt: Date.now() + 3600_000 };
}

const norm = (email: string) => email.trim().toLowerCase();

export function createDemoAuth(): AuthProvider {
  return {
    mode: "demo",
    async signUp(rawEmail, password, name) {
      const email = norm(rawEmail);
      const users = load();
      if (users[email]?.verified) throw new AuthError("UsernameExistsException");
      checkPassword(password);
      users[email] = { name: name.trim(), hash: await hash(password), verified: false };
      return issue(users, email);
    },
    async confirmSignUp(rawEmail, code) {
      const users = load();
      const user = users[norm(rawEmail)];
      consumeCode(user, code);
      if (user) user.verified = true;
      save(users);
    },
    async resendCode(rawEmail) {
      return issue(load(), norm(rawEmail));
    },
    async signIn(rawEmail, password) {
      const email = norm(rawEmail);
      const user = load()[email];
      if (!user || user.hash !== (await hash(password))) throw new AuthError("NotAuthorizedException");
      if (!user.verified) throw new AuthError("UserNotConfirmedException");
      return session(email, user.name || email.split("@")[0] || "Family");
    },
    async refresh(s) {
      return { ...s, expiresAt: Date.now() + 3600_000 };
    },
    async forgotPassword(rawEmail) {
      const email = norm(rawEmail);
      const users = load();
      // Like Cognito with PreventUserExistenceErrors: don't reveal whether the account exists.
      if (!users[email]) return { destination: email };
      return issue(users, email);
    },
    async confirmForgotPassword(rawEmail, code, newPassword) {
      const users = load();
      const user = users[norm(rawEmail)];
      consumeCode(user, code);
      checkPassword(newPassword);
      if (user) {
        user.hash = await hash(newPassword);
        user.verified = true;
      }
      save(users);
    },
    async signOut() {},
  };
}
