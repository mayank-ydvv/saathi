import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../auth/session";
import { BorderBeam } from "../../components/ui/BorderBeam";
import { DotPattern } from "../../components/ui/DotPattern";
import { OrbitingCircles } from "../../components/ui/OrbitingCircles";
import { BlurFade } from "../../components/ui/motion";
import { ThemeToggle } from "../../components/ui/ThemeToggle";
import { FAMILY } from "../../lib/family";

function Mark() {
  return (
    <Link to="/login" className="flex items-center gap-2 text-ink" aria-label="Saathi">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
        {[0, 60, 120].map((r) => (
          <ellipse key={r} cx="12" cy="12" rx="4" ry="10" transform={`rotate(${r} 12 12)`} />
        ))}
      </svg>
      <span className="flare text-[24px] leading-none">saathi</span>
    </Link>
  );
}

/** Split screen: the form in a bordered card on the left, the family orbiting Ma on the right. */
export function AuthLayout({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  const [ma, ...others] = FAMILY;
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Mark />
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-center justify-center py-10">
          <BlurFade className="w-full max-w-[400px]">
            <div className="relative overflow-hidden rounded-[6px] border border-line bg-surface p-6 sm:p-8">
              <BorderBeam duration={9} size={90} />
              <h1 className="text-[34px] leading-none">{title}</h1>
              {sub ? <p className="mt-3 text-muted">{sub}</p> : null}
              <div className="mt-6">{children}</div>
            </div>
            {auth.mode === "demo" ? (
              <p className="mt-4 text-center text-xs text-muted">
                Demo sign-in: accounts stay in this browser and codes are shown on screen instead of
                emailed. Set VITE_COGNITO_CLIENT_ID to use Amazon Cognito.
              </p>
            ) : null}
          </BlurFade>
        </main>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface-2 lg:flex lg:items-center lg:justify-center">
        <DotPattern className="text-ink/10 [mask-image:radial-gradient(420px_circle_at_center,white,transparent)]" />
        <div className="relative flex size-[520px] items-center justify-center">
          {ma ? (
            <img src={ma.src} alt="" className="z-10 h-28 w-28 rounded-full border-4 border-surface object-cover" />
          ) : null}
          <OrbitingCircles radius={130} duration={30} iconSize={60}>
            {others.slice(0, 3).map((p) => (
              <img key={p.name} src={p.src} alt="" className="size-full rounded-full border-2 border-surface object-cover" />
            ))}
          </OrbitingCircles>
          <OrbitingCircles radius={220} duration={45} iconSize={52} reverse>
            {others.slice(3).map((p) => (
              <img key={p.name} src={p.src} alt="" className="size-full rounded-full border-2 border-surface object-cover" />
            ))}
          </OrbitingCircles>
        </div>
        <p className="flare absolute inset-x-0 bottom-12 mx-auto max-w-[420px] px-6 text-center text-[28px] leading-tight text-ink">
          Everyone who looks out for Ma, in one place.
        </p>
      </aside>
    </div>
  );
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = input.id ?? input.name;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-sm text-ink">
        {label}
      </label>
      <input
        id={id}
        {...input}
        className="block min-h-12 w-full rounded-[6px] border border-line bg-canvas px-3 text-[17px] text-ink outline-none placeholder:text-muted focus:border-accent"
      />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-[4px] bg-accent px-5 text-[17px] text-accent-ink transition disabled:opacity-60"
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-[6px] bg-bad-bg px-3 py-2 text-sm text-bad-ink">
      {message}
    </p>
  );
}

/** Demo mode only: the code that Cognito would have emailed. */
export function DemoCode({ code }: { code?: string }) {
  if (!code) return null;
  return (
    <p role="status" className="mb-4 rounded-[6px] bg-warn-bg px-3 py-2 text-sm text-warn-ink">
      Demo mode, so no email was sent. Your code is <span className="tabular-nums text-base">{code}</span>
    </p>
  );
}
