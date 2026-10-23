/** What a signed-in family member's session holds (tokens are Cognito JWTs in "cognito" mode). */
export type Session = {
  email: string;
  name: string;
  idToken: string;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the id/access tokens expire. */
  expiresAt: number;
};

/** Where a code was sent. In demo mode there is no email, so the code itself is returned. */
export type CodeDelivery = { destination: string; demoCode?: string };

/** One interface, two backends: Amazon Cognito (real emails) and a local demo store. */
export interface AuthProvider {
  readonly mode: "cognito" | "demo";
  signUp(email: string, password: string, name: string): Promise<CodeDelivery>;
  confirmSignUp(email: string, code: string): Promise<void>;
  resendCode(email: string): Promise<CodeDelivery>;
  signIn(email: string, password: string): Promise<Session>;
  refresh(session: Session): Promise<Session>;
  forgotPassword(email: string): Promise<CodeDelivery>;
  confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>;
  signOut(session: Session): Promise<void>;
}

/** Cognito's error names, kept as codes so screens can react (e.g. go to "verify"). */
export type AuthErrorCode =
  | "UsernameExistsException"
  | "UserNotConfirmedException"
  | "NotAuthorizedException"
  | "CodeMismatchException"
  | "ExpiredCodeException"
  | "InvalidPasswordException"
  | "InvalidParameterException"
  | "LimitExceededException"
  | "TooManyRequestsException"
  | "UserNotFoundException"
  | "NetworkError"
  | "Unknown";

const FRIENDLY: Partial<Record<AuthErrorCode, string>> = {
  UsernameExistsException: "There's already an account with this email. Try logging in.",
  UserNotConfirmedException: "Please verify your email first. We've sent you a code.",
  NotAuthorizedException: "Wrong email or password.",
  CodeMismatchException: "That code doesn't match. Check the email and try again.",
  ExpiredCodeException: "That code has expired. Ask for a new one.",
  LimitExceededException: "Too many attempts. Please wait a few minutes and try again.",
  TooManyRequestsException: "Too many attempts. Please wait a few minutes and try again.",
  UserNotFoundException: "Wrong email or password.",
  NetworkError: "Can't reach the sign-in service. Check your connection.",
};

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    detail?: string,
  ) {
    // Password-policy and parameter errors carry Cognito's own (useful) wording.
    super(FRIENDLY[code] ?? detail ?? "Something went wrong. Please try again.");
    this.name = "AuthError";
  }
}
