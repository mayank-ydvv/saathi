import { describe, expect, it } from "vitest";
import { OPTIONS, option, type Slot } from "./photoOptions";
import { family, hero, img } from "./photos";

describe("photo options", () => {
  it("offers 3 or 4 choices for every slot", () => {
    for (const [slot, list] of Object.entries(OPTIONS)) {
      expect(list.length, slot).toBeGreaterThanOrEqual(3);
      expect(list.length, slot).toBeLessThanOrEqual(4);
    }
  });

  it("uses the first option outside the dev picker", () => {
    expect(option("hero")).toBe(OPTIONS.hero[0]);
  });

  it("only places hero faces inside the photo", () => {
    for (const o of OPTIONS.hero) {
      for (const f of Object.values(o.faces ?? {})) {
        expect(f.x).toBeGreaterThan(0);
        expect(f.x).toBeLessThan(1);
        expect(f.y).toBeGreaterThan(0);
        expect(f.y).toBeLessThan(1);
      }
    }
  });

  it("gives every hand a phone rectangle", () => {
    for (const o of OPTIONS.hand) expect(o.screen).toBeDefined();
  });

  it("maps hero faces onto family members by key", () => {
    expect(hero.faces).toHaveLength(family.length);
    const slot: Slot = "hero";
    const keys = Object.keys(OPTIONS[slot][0]?.faces ?? {});
    family.forEach((m, i) => expect(Boolean(hero.faces[i])).toBe(keys.includes(m.key)));
  });
});

describe("img", () => {
  it("builds Unsplash, Pexels and local URLs", () => {
    expect(img({ src: "u:photo-1" }, 400)).toBe("https://images.unsplash.com/photo-1?w=400&q=75&auto=format&fit=max");
    expect(img({ src: "p:1/pexels-photo-1.jpeg" }, 400)).toBe(
      "https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=tinysrgb&w=400",
    );
    expect(img({ src: "l:/hands/hand-1.webp" }, 400)).toBe("/hands/hand-1.webp");
  });
});
