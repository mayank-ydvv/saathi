/**
 * Log in, sign up, verify email and reset password. Every call goes through `auth` (Amazon
 * Cognito, or the demo store when it isn't configured); Cognito emails the 6-digit codes.
 */
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { auth, setSession, useSession } from "../../auth/session";
import { AuthError } from "../../auth/types";
import { useTitle } from "../../hooks/useTitle";
import { AuthLayout, DemoCode, Field, FormError, SubmitButton } from "./AuthLayout";

type FlowState = { demoCode?: string; from?: string; notice?: string } | null;

function message(e: unknown): string {
  return e instanceof AuthError ? e.message : "Something went wrong. Please try again.";
}

/** Runs an auth call with busy/error state. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

const linkCls = "text-ink underline underline-offset-4 hover:text-accent";

export function Login() {
  useTitle("Log in");
  const session = useSession();
  const navigate = useNavigate();
  const state = useLocation().state as FlowState;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();

  if (session) return <Navigate to={state?.from ?? "/"} replace />;

  const submit = run(async () => {
    try {
      setSession(await auth.signIn(email, password));
      navigate(state?.from ?? "/", { replace: true });
    } catch (err) {
      if (err instanceof AuthError && err.code === "UserNotConfirmedException") {
        const sent = await auth.resendCode(email);
        navigate(`/verify?email=${encodeURIComponent(email)}`, { state: { demoCode: sent.demoCode } });
        return;
      }
      throw err;
    }
  });

  return (
    <AuthLayout title="Welcome back" sub="Log in to see how Ma's day is going.">
      {state?.notice ? (
        <p role="status" className="mb-4 rounded-[6px] bg-ok-bg px-3 py-2 text-sm text-ok-ink">
          {state.notice}
        </p>
      ) : null}
      <form onSubmit={submit} noValidate={false}>
        <FormError message={error} />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="-mt-2 mb-4 text-right text-sm">
          <Link to="/forgot" className={linkCls}>
            Forgot password?
          </Link>
        </div>
        <SubmitButton busy={busy}>Log in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to Saathi?{" "}
        <Link to="/signup" className={linkCls}>
          Create a family account
        </Link>
      </p>
    </AuthLayout>
  );
}

export function SignUp() {
  useTitle("Create account");
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();

  const submit = run(async () => {
    const sent = await auth.signUp(email.trim(), password, name.trim());
    navigate(`/verify?email=${encodeURIComponent(email.trim())}`, { state: { demoCode: sent.demoCode } });
  });

  return (
    <AuthLayout title="Join your family" sub="We'll email you a code to check it's really you.">
      <form onSubmit={submit}>
        <FormError message={error} />
        <Field label="Your name" name="name" autoComplete="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} hint="Shown to the family when you say “I'm checking”." />
        <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters, with a lowercase letter and a number." />
        <SubmitButton busy={busy}>Create account</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className={linkCls}>
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

export function Verify() {
  useTitle("Verify email");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const state = useLocation().state as FlowState;
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState(state?.demoCode);
  const [resent, setResent] = useState(false);
  const { busy, error, setError, run } = useSubmit();

  if (!email) return <Navigate to="/signup" replace />;

  const submit = run(async () => {
    await auth.confirmSignUp(email, code);
    navigate("/login", { replace: true, state: { notice: "Email verified. You can log in now." } });
  });

  async function resend() {
    setError(null);
    try {
      const sent = await auth.resendCode(email);
      setDemoCode(sent.demoCode);
      setResent(true);
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <AuthLayout title="Check your email" sub={<>We sent a 6-digit code to <span className="text-ink">{email}</span>.</>}>
      <form onSubmit={submit}>
        <DemoCode code={demoCode} />
        <FormError message={error} />
        <Field label="Verification code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <SubmitButton busy={busy}>Verify email</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {resent ? "A new code is on its way. " : "Didn't get it? Check spam, or "}
        <button type="button" onClick={() => void resend()} className={linkCls}>
          send a new code
        </button>
      </p>
    </AuthLayout>
  );
}

export function Forgot() {
  useTitle("Reset password");
  const navigate = useNavigate();
  const [step, setStep] = useState<"ask" | "reset">("ask");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [demoCode, setDemoCode] = useState<string>();
  const { busy, error, run } = useSubmit();

  const ask = run(async () => {
    const sent = await auth.forgotPassword(email.trim());
    setDemoCode(sent.demoCode);
    setStep("reset");
  });
  const reset = run(async () => {
    await auth.confirmForgotPassword(email.trim(), code, password);
    navigate("/login", { replace: true, state: { notice: "Password changed. Log in with your new password." } });
  });

  return (
    <AuthLayout
      title="Reset your password"
      sub={step === "ask" ? "We'll email you a code to set a new one." : <>If an account exists for <span className="text-ink">{email}</span>, we've emailed it a code.</>}
    >
      {step === "ask" ? (
        <form onSubmit={ask}>
          <FormError message={error} />
          <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <SubmitButton busy={busy}>Send code</SubmitButton>
        </form>
      ) : (
        <form onSubmit={reset}>
          <DemoCode code={demoCode} />
          <FormError message={error} />
          <Field label="Code from the email" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <Field label="New password" name="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters, with a lowercase letter and a number." />
          <SubmitButton busy={busy}>Set new password</SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className={linkCls}>
          Back to log in
        </Link>
      </p>
    </AuthLayout>
  );
}
