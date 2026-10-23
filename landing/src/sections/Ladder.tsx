import { Timeline } from "../components/ui/Timeline";

function Step({ time, text, note }: { time: string; text: string; note: string }) {
  return (
    <div className="rounded-[6px] border border-pressed-cotton bg-parchment p-5 sm:p-6">
      <div className="text-caption uppercase text-slate">{time}</div>
      <p className="mt-2 text-body-lg text-graphite">{text}</p>
      <p className="mt-2 text-body text-slate">{note}</p>
    </div>
  );
}

/**
 * The escalation ladder as an Aceternity "Timeline": each rung sticks while you read it and
 * the line fills as you scroll. Times follow the "fall day" demo scenario with the default
 * waits in .env.example (ESC_WAIT_SUSPECT 5 min, ESC_WAIT_NUDGE 5 min, ESC_WAIT_FAMILY 10 min).
 */
export function Ladder() {
  const data = [
    {
      title: "17:05",
      content: (
        <Step
          time="Something isn't usual"
          text="No movement anywhere for 4 h 5 min. Last seen in the living room at 13:00."
          note="Saathi waits a short grace period, in case Ma is just resting."
        />
      ),
    },
    {
      title: "17:10",
      content: (
        <Step
          time="Ask Ma first"
          text="“Kamala ji, are you okay?” in a calm voice, with one big green button."
          note="One tap ends it here. The family never needs to know."
        />
      ),
    },
    {
      title: "17:15",
      content: (
        <Step
          time="Tell the family"
          text="Telegram to Rahul and Priya with the reason and when she was last seen."
          note="Whoever taps “I'm checking” first takes it, and everyone else sees that."
        />
      ),
    },
    {
      title: "17:25",
      content: (
        <Step
          time="Then a neighbour"
          text="Mrs Iyer next door gets the same alert, and can knock."
          note="Every step is logged, so the family can see exactly what happened."
        />
      ),
    },
  ];
  return (
    <section className="py-[60px] sm:py-[80px]" aria-label="The escalation ladder">
      <Timeline
        data={data}
        title="Help climbs one step at a time"
        sub="Saathi never jumps straight to alarm. It climbs a gentle ladder, and any “I'm okay” or “I'm checking” stops it."
      />
    </section>
  );
}
