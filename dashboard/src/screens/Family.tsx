import { Eye, House, MessageCircle, Users, Volume2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Contact } from "../api/types";
import { useSession } from "../auth/session";
import { CallLink } from "../components/CallLink";
import { FamilyName } from "../components/FamilyName";
import { HelpNote } from "../components/HelpNote";
import { Card, CardHeader, PageTitle } from "../components/States";
import { BlurFade } from "../components/ui/motion";
import { useTitle } from "../hooks/useTitle";
import { FAMILY } from "../lib/family";
import { useLive } from "../state/LiveData";

/** A portrait (given, or the demo family's for this name), else the initial. */
function Avatar({ name, src, size = "size-12" }: { name: string; src?: string; size?: string }) {
  const photo = src ?? FAMILY.find((p) => p.name === name)?.src;
  return photo ? (
    <img src={photo} alt="" className={`${size} shrink-0 rounded-full object-cover ring-2 ring-surface`} />
  ) : (
    <span className={`${size} grid shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-ink ring-2 ring-surface`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Person({ name, note, src }: { name: string; note?: string; src?: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl bg-surface-2/70 p-2 pr-4">
      <Avatar name={name} src={src} />
      <span className="min-w-0">
        <span className="block font-semibold">{name}</span>
        {note ? <span className="block text-sm text-muted">{note}</span> : null}
      </span>
    </li>
  );
}

function Step({
  n,
  icon: IconCmp,
  title,
  when,
  how,
  children,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  when: string;
  how: string;
  children?: ReactNode;
}) {
  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <span className="absolute top-12 bottom-0 left-[23px] w-0.5 bg-line" aria-hidden="true" />
      <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-card">
        <IconCmp className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-bold tracking-[0.12em] text-gold uppercase">
          Step {n} · {when}
        </p>
        <h3 className="mt-0.5 text-xl font-semibold">{title}</h3>
        <p className="mt-1 text-muted">{how}</p>
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </li>
  );
}

export function Family() {
  useTitle("Family");
  const { home } = useLive();
  const session = useSession();
  const parent = home.data?.parent_name ?? "Your parent";
  const contacts: Contact[] = home.data?.contacts ?? [];
  const family = contacts.filter((c) => c.role === "family");
  const neighbours = contacts.filter((c) => c.role === "neighbour");
  const me = session?.name?.trim();

  return (
    <>
      <PageTitle sub="Who Saathi reaches at each step of an alert, and how.">Family circle</PageTitle>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="When something looks wrong" sub="Each step waits for an answer before going to the next. Any answer stops it." />
          <ol aria-label="Who is reached at each step">
            <Step n={1} icon={Eye} title="Saathi notices" when="Straight away" how="A late start, a long quiet spell or the door at night. It waits a few minutes in case all is well." />
            <Step
              n={2}
              icon={Volume2}
              title={`Asks ${parent}`}
              when="After about 5 minutes"
              how={`The parent app speaks "Are you okay?" and shows one big I'm okay button.`}
            >
              <ul className="flex flex-wrap items-center gap-3">
                <Person name={parent} src={FAMILY[0]?.src} note="Parent app, voice nudge" />
                {home.data?.parent_phone ? (
                  <li>
                    <CallLink phone={home.data.parent_phone} name={parent} />
                  </li>
                ) : null}
              </ul>
            </Step>
            <Step
              n={3}
              icon={Users}
              title="Alerts the family"
              when="About 5 minutes later"
              how="A Telegram message to the family chat, and this dashboard turns red. Anyone can answer I'm checking."
            >
              <ul className="flex flex-wrap gap-3">
                {family.map((c) => (
                  <Person key={`family-${c.name}`} name={c.name} note="Telegram, family chat" />
                ))}
                {me && !family.some((c) => c.name === me) ? <Person name={me} note="You · this dashboard" /> : null}
                {!family.length && !me ? <li className="text-muted">No family contact set up yet.</li> : null}
              </ul>
            </Step>
            <Step
              n={4}
              icon={House}
              title="Calls on the neighbour"
              when="About 10 minutes later"
              how="If nobody in the family has answered, a trusted neighbour is asked to knock on the door."
            >
              <ul className="flex flex-wrap gap-3">
                {neighbours.length ? (
                  neighbours.map((c) => <Person key={`neighbour-${c.name}`} name={c.name} note="Telegram" />)
                ) : (
                  <li className="text-muted">No neighbour set up yet.</li>
                )}
              </ul>
            </Step>
          </ol>
        </Card>

        <div className="flex flex-col gap-6">
          <BlurFade>
            <Card>
              <CardHeader title="You" sub="The name sent when you press I'm checking." />
              <div className="flex items-center gap-3">
                <Avatar name={me || "?"} size="size-14" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{me || "Family member"}</p>
                  <p className="truncate text-sm text-muted">{session?.email}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <FamilyName />
              </div>
            </Card>
          </BlurFade>
          <BlurFade delay={0.05}>
            <Card>
              <CardHeader title="How messages arrive" />
              <ul className="space-y-3 text-[15px]">
                <li className="flex gap-3">
                  <Volume2 className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">{parent}</strong> hears a spoken nudge on the parent app, in English or
                    Hindi.
                  </span>
                </li>
                <li className="flex gap-3">
                  <MessageCircle className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">Family and neighbour</strong> get a Telegram message with an I'm
                    checking button.
                  </span>
                </li>
                <li className="flex gap-3">
                  <Users className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    <strong className="font-semibold">Everyone</strong> sees the same status here, and who answered.
                  </span>
                </li>
              </ul>
            </Card>
          </BlurFade>
        </div>
      </div>

      <div className="mt-8">
        <HelpNote title="How do I change who is contacted?">
          <p>
            Contacts are set when Saathi is installed for the home. Ask whoever set it up to change the family or
            neighbour contact, or to add {parent}'s phone number so the Call button appears.
          </p>
        </HelpNote>
      </div>
    </>
  );
}
