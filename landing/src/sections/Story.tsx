import { useEffect, useRef } from "react";
import { Phone } from "../components/Phone";
import { WordRotate } from "../components/ui/WordRotate";
import { DigestScreen, FamilyGridScreen } from "../components/Screens";
import { DASHBOARD_URL } from "../config";
import { easeInOut, easeOut, lerp, seg, useScrollProgress } from "../lib/motion";
import { family, hand, hero, img } from "../photos";

/*
 * The pinned opening sequence from the reference video, driven by scroll progress p (0..1):
 *   hero photo  → dissolves; the people in it pop out as circles        p 0.04–0.20
 *   caregivers  → circles scatter round the heading, worries appear     p 0.15–0.48
 *   phone       → circles gather in an arc and drop into a phone        p 0.46–0.68
 *   digest      → background turns rose, the phone shows the digest     p 0.70–0.82
 * Every frame writes transforms straight to the DOM (no React renders), O(people) per frame.
 */

type Pt = { x: number; y: number };
type Layout = { scatter: Pt[]; chip: { dx: number; dy: number; align: "l" | "c" | "r" }[] };

const DESKTOP: Layout = {
  scatter: [
    { x: 0.19, y: 0.6 },
    { x: 0.27, y: 0.38 },
    { x: 0.41, y: 0.24 },
    { x: 0.59, y: 0.26 },
    { x: 0.73, y: 0.37 },
    { x: 0.82, y: 0.6 },
  ],
  chip: [
    { dx: 0, dy: 0.78, align: "c" },
    { dx: 0, dy: 0.78, align: "c" },
    { dx: -0.1, dy: -0.72, align: "c" },
    { dx: 0.62, dy: -0.25, align: "l" },
    { dx: 0.35, dy: 0.78, align: "l" },
    { dx: 0, dy: 0.78, align: "c" },
  ],
};

// Phones: the circles form an arc above the heading, and the worries take turns below it.
const MOBILE: Layout = {
  scatter: [
    { x: 0.13, y: 0.4 },
    { x: 0.25, y: 0.24 },
    { x: 0.42, y: 0.15 },
    { x: 0.6, y: 0.15 },
    { x: 0.76, y: 0.24 },
    { x: 0.87, y: 0.4 },
  ],
  chip: [],
};

export function Story() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const heroLayer = useRef<HTMLDivElement>(null);
  const rose = useRef<HTMLDivElement>(null);
  const caregivers = useRef<HTMLDivElement>(null);
  const system = useRef<HTMLDivElement>(null);
  const gathers = useRef<HTMLDivElement>(null);
  const phoneGroup = useRef<HTMLDivElement>(null);
  const handImg = useRef<HTMLImageElement>(null);
  const gridScreen = useRef<HTMLDivElement>(null);
  const digestScreen = useRef<HTMLDivElement>(null);
  const avatars = useRef<(HTMLDivElement | null)[]>([]);
  const crops = useRef<(HTMLDivElement | null)[]>([]);
  const chips = useRef<(HTMLDivElement | null)[]>([]);
  const size = useRef({ W: 1280, H: 800 });

  useEffect(() => {
    const measure = () => {
      const el = stage.current;
      if (el) size.current = { W: el.clientWidth, H: el.clientHeight };
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useScrollProgress(section, (p) => {
    const { W, H } = size.current;
    const mobile = W < 720;
    const L = mobile ? MOBILE : DESKTOP;
    const S = mobile ? Math.min(0.17 * W, 84) : Math.min(Math.max(0.072 * W, 64), 112);

    // Hero photo under object-cover: where each face lands on the stage.
    const cs = Math.max(W / (H * hero.aspect), 1) * H;
    const coverW = cs * hero.aspect;
    const coverH = cs;
    const ox = (W - coverW) / 2;
    const oy = (H - coverH) / 2;

    // Phone geometry: 3 × 2 cells inside the screen.
    const pw = mobile ? 0.5 * W : Math.min(Math.max(0.15 * W, 170), 240);
    const ph = pw * (19.2 / 9);
    const pTop = mobile ? 0.34 * H : 0.4 * H;
    const cellW = (pw * 0.94) / 3;
    const cellH = (ph * 0.94 * 0.72) / 2;
    const gridTop = pTop + ph * 0.03 + ph * 0.94 * 0.25;

    const dissolve = seg(p, 0.04, 0.14);
    const toScatter = easeInOut(seg(p, 0.09, 0.21));
    const toArc = easeInOut(seg(p, 0.46, 0.55));
    const toCell = easeInOut(seg(p, 0.55, 0.65));
    const rise = easeOut(seg(p, 0.5, 0.63));

    family.forEach((_, i) => {
      const a = avatars.current[i];
      const crop = crops.current[i];
      const chip = chips.current[i];
      if (!a) return;
      const face = hero.faces[i];
      const sc = L.scatter[i] ?? { x: 0.5, y: 0.5 };
      const start = face
        ? { x: ox + face.x * coverW, y: oy + face.y * coverH, s: face.r * 2 * coverW }
        : { x: sc.x * W, y: sc.y * H, s: S * 0.6 };
      const n = family.length;
      const ang = Math.PI * (1.08 + (0.84 * i) / (n - 1));
      const arc = { x: W / 2 + Math.cos(ang) * pw * 0.95, y: pTop - S * 0.2 + Math.sin(ang) * pw * 0.55 };
      const cell = {
        x: W / 2 - pw * 0.47 + cellW * ((i % 3) + 0.5),
        y: gridTop + cellH * (Math.floor(i / 3) + 0.5),
      };
      let x = lerp(start.x, sc.x * W, toScatter);
      let y = lerp(start.y, sc.y * H, toScatter);
      let s = lerp(start.s, S, toScatter);
      x = lerp(x, arc.x, toArc);
      y = lerp(y, arc.y, toArc);
      s = lerp(s, S * 0.82, toArc);
      x = lerp(x, cell.x, toCell);
      y = lerp(y, cell.y, toCell);
      s = lerp(s, Math.min(cellW, cellH) * 0.92, toCell);
      const appear = face ? seg(p, 0.05, 0.08) : seg(p, 0.12, 0.18);
      a.style.opacity = String(appear * (1 - seg(p, 0.66, 0.69)));
      a.style.width = a.style.height = `${s}px`;
      a.style.transform = `translate(${x - s / 2}px, ${y - s / 2}px)`;
      if (crop && face) {
        // Keep showing the matching patch of the hero photo until the portrait fades in.
        const k = s / start.s;
        crop.style.opacity = String(1 - seg(p, 0.1, 0.17));
        crop.style.backgroundSize = `${coverW * k}px ${coverH * k}px`;
        crop.style.backgroundPosition = `${-(start.x - start.s / 2 - ox) * k}px ${-(start.y - start.s / 2 - oy) * k}px`;
      }
      if (chip) {
        const c = L.chip[i];
        const from = 0.23 + i * 0.03;
        if (c) {
          const show = seg(p, from, from + 0.03) * (1 - seg(p, 0.43, 0.47));
          const shift = c.align === "c" ? "-50%" : c.align === "r" ? "-100%" : "0%";
          chip.style.opacity = String(show);
          chip.style.transform = `translate(${x + c.dx * S}px, ${y + c.dy * S}px) translate(${shift}, -50%) translateY(${(1 - show) * 6}px)`;
        } else {
          // One worry at a time, centred under the paragraph; the last one stays.
          const last = i === family.length - 1;
          const show = seg(p, from, from + 0.012) * (last ? 1 - seg(p, 0.43, 0.47) : 1 - seg(p, from + 0.026, from + 0.03));
          chip.style.opacity = String(show);
          chip.style.transform = `translate(${W / 2}px, ${H * 0.84}px) translate(-50%, -50%) translateY(${(1 - show) * 8}px)`;
        }
      }
    });

    const set = (el: HTMLElement | null, o: number, dy = 0) => {
      if (!el) return;
      el.style.opacity = String(o);
      el.style.transform = `translateY(${dy}px)`;
      el.style.visibility = o < 0.01 ? "hidden" : "visible";
    };
    if (heroLayer.current) {
      heroLayer.current.style.opacity = String(1 - seg(p, 0.07, 0.15));
      heroLayer.current.style.filter = `blur(${dissolve * 22}px)`;
      heroLayer.current.style.transform = `scale(${1 + dissolve * 0.04})`;
      heroLayer.current.style.visibility = p > 0.16 ? "hidden" : "visible";
    }
    const cg = seg(p, 0.15, 0.22) * (1 - seg(p, 0.43, 0.47));
    set(caregivers.current, cg, (1 - seg(p, 0.15, 0.22)) * 16);
    const sy = seg(p, 0.56, 0.63);
    set(system.current, sy * (1 - seg(p, 0.71, 0.75)), (1 - sy) * 16);
    const ga = seg(p, 0.75, 0.82);
    set(gathers.current, ga, (1 - ga) * 16);
    if (rose.current) rose.current.style.opacity = String(seg(p, 0.7, 0.8));
    if (phoneGroup.current) {
      phoneGroup.current.style.opacity = String(seg(p, 0.5, 0.58));
      phoneGroup.current.style.transform = `translate(-50%, ${(1 - rise) * H * 0.45}px)`;
      phoneGroup.current.style.top = `${pTop}px`;
      phoneGroup.current.style.width = `${pw}px`;
    }
    if (handImg.current) {
      // hand.screen is the phone's rectangle in the photo, as fractions of the photo width.
      const hw = pw / hand.screen.w;
      handImg.current.style.width = `${hw}px`;
      handImg.current.style.transform = `translate(${-hand.screen.x * hw}px, ${-hand.screen.y * hw}px)`;
    }
    if (gridScreen.current) gridScreen.current.style.opacity = String(seg(p, 0.62, 0.67));
    if (digestScreen.current) digestScreen.current.style.opacity = String(seg(p, 0.74, 0.8));
  });

  return (
    <section ref={section} className="relative h-[760vh]" aria-label="What Saathi does">
      <div ref={stage} className="sticky top-0 h-svh overflow-hidden bg-parchment">
        <div
          ref={rose}
          className="absolute inset-0 opacity-0"
          style={{
            background:
              "radial-gradient(60% 70% at 12% 30%, #f1e7ee 0%, transparent 60%), radial-gradient(55% 60% at 88% 70%, #e7b9a2 0%, transparent 65%), radial-gradient(70% 80% at 50% 50%, #dcc2d3 0%, #efe3ea 70%)",
          }}
        />

        <div ref={heroLayer} className="absolute inset-0 origin-center will-change-[filter,opacity]">
          <img
            src={img(hero.photo, 2000)}
            alt="Three generations of an Indian family together outdoors"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: hero.photo.focus }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
          <div className="relative flex h-full flex-col px-4 pb-4 pt-5 text-white sm:px-[34px]">
            <div className="max-w-[420px] pt-14 sm:pt-[72px]">
              <h1 className="flare text-[40px] sm:text-heading">
                When your parents live far away, let Saathi{" "}
                <WordRotate words={["keep watch.", "check in.", "call for help."]} duration={2600} />
              </h1>
              <p className="mt-4 max-w-[340px] text-body">
                Saathi (“saa-thee”, Hindi for companion) learns your parent’s daily rhythm from the
                Ring devices already at home, and quietly checks in when a day doesn’t look normal.
              </p>
              <a
                href={DASHBOARD_URL}
                className="mt-5 inline-flex items-center gap-3 rounded-[6px] border border-deep-ink bg-white py-1 pl-3 pr-[18px] text-body text-deep-ink"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-deep-ink" />
                Open the family dashboard <span aria-hidden>→</span>
              </a>
            </div>
            <div className="flare mt-auto select-none text-[30vw] leading-[0.78] sm:text-[22vw]" aria-hidden>
              Saathi
            </div>
          </div>
        </div>

        {family.map((m, i) => (
          <div
            key={m.key}
            ref={(el) => {
              avatars.current[i] = el;
            }}
            className="absolute left-0 top-0 overflow-hidden rounded-full bg-pressed-cotton opacity-0 will-change-transform"
          >
            <img
              src={img(m.photo, 240)}
              alt={m.name}
              className="h-full w-full object-cover"
              style={{ objectPosition: m.photo.focus }}
            />
            {hero.faces[i] && (
              <div
                ref={(el) => {
                  crops.current[i] = el;
                }}
                className="absolute inset-0 bg-no-repeat"
                style={{ backgroundImage: `url(${img(hero.photo, 2000)})` }}
              />
            )}
          </div>
        ))}

        {family.map((m, i) => (
          <div
            key={m.key}
            ref={(el) => {
              chips.current[i] = el;
            }}
            className="absolute left-0 top-0 whitespace-nowrap rounded-[4px] border border-pressed-cotton bg-parchment/90 px-2 py-1 text-[13px] leading-[1.15] text-slate opacity-0 sm:text-caption"
          >
            {m.question}
          </div>
        ))}

        <div
          ref={caregivers}
          className="pointer-events-none absolute inset-x-0 top-[52%] mx-auto max-w-[560px] px-4 text-center opacity-0 sm:top-[50%]"
        >
          <h2 className="flare text-[34px] sm:text-heading">For the children who worry from afar</h2>
          <p className="mx-auto mt-4 max-w-[460px] text-body text-slate">
            Your mind is full of small worries about Ma and Papa. Saathi learns their routine and
            keeps an eye on it, so you can stop wondering and call when it matters.
          </p>
        </div>

        <div ref={system} className="absolute inset-x-0 top-[7%] mx-auto max-w-[600px] px-4 text-center opacity-0">
          <h2 className="flare text-[34px] sm:text-heading">A quiet guardian, built on Ring</h2>
          <p className="mx-auto mt-4 max-w-[520px] text-body text-slate">
            The doorbell and the cameras already in the house tell Saathi when Ma wakes, cooks, rests
            and answers the door. Nobody watches a video feed, and nothing needs to be worn.
          </p>
        </div>

        <div ref={gathers} className="absolute inset-x-0 top-[7%] mx-auto max-w-[620px] px-4 text-center opacity-0">
          <p className="flare text-[28px] sm:text-heading-sm">
            Saathi turns the small signals of a day into one evening digest, and alerts you can act on.
          </p>
        </div>

        <div ref={phoneGroup} className="absolute left-1/2 opacity-0 will-change-transform">
          <img
            ref={handImg}
            src={img(hand.photo, 900)}
            alt=""
            className="pointer-events-none absolute left-0 top-0 max-w-none"
          />
          <Phone className="relative w-full">
            <div ref={gridScreen} className="absolute inset-0 opacity-0">
              <FamilyGridScreen />
            </div>
            <div ref={digestScreen} className="absolute inset-0 opacity-0">
              <DigestScreen />
            </div>
          </Phone>
        </div>
      </div>
    </section>
  );
}
