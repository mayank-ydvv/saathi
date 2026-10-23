/**
 * Every photo on the page, resolved from the options in photoOptions.ts, so swapping a
 * picture is a one-line change there. All are free-licence Unsplash or Pexels photos loaded
 * from their CDNs; photographer credits are in landing/README.md.
 */
import { option, type Face } from "./photoOptions";

export type Photo = { src: string; focus?: string };

export function img(p: Photo, w: number): string {
  if (p.src.startsWith("l:")) return p.src.slice(2);
  if (p.src.startsWith("u:")) {
    return `https://images.unsplash.com/${p.src.slice(2)}?w=${w}&q=75&auto=format&fit=max`;
  }
  return `https://images.pexels.com/photos/${p.src.slice(2)}?auto=compress&cs=tinysrgb&w=${w}`;
}

export type Member = { key: string; name: string; role: string; photo: Photo; question: string };

const heroOpt = option("hero");

export const ma: Member = { key: "ma", name: "Ma", role: "Kamala, 72", photo: option("ma"), question: "Has Ma been in the kitchen yet today?" };
export const papa: Member = { key: "papa", name: "Papa", role: "Mohan, 75", photo: option("papa"), question: "Is Papa up? He’s usually out by seven." };
export const rahul: Member = { key: "rahul", name: "Rahul", role: "Son, Bengaluru", photo: option("rahul"), question: "Who rang Ma’s doorbell at 2 a.m.?" };
export const priya: Member = { key: "priya", name: "Priya", role: "Daughter, Pune", photo: option("priya"), question: "Why isn’t Papa picking up the phone?" };
export const aarav: Member = { key: "aarav", name: "Aarav", role: "Grandson", photo: option("aarav"), question: "Did Nani have a good day?" };
export const neighbour: Member = { key: "neighbour", name: "Mrs Iyer", role: "Neighbour", photo: option("neighbour"), question: "Can someone next door check on Ma?" };

/** In scatter order: left to right around the caregivers heading. */
export const family: Member[] = [ma, papa, rahul, priya, aarav, neighbour];

/** Hero photo (3:2, shown with object-cover centred) and where each family member's face is. */
export const hero = {
  photo: { src: heroOpt.src, focus: "50% 50%" } as Photo,
  aspect: 1.5,
  faces: family.map((m) => heroOpt.faces?.[m.key]) as (Face | undefined)[],
};

const handOpt = option("hand");
export const hand = {
  photo: { src: handOpt.src } as Photo,
  screen: handOpt.screen ?? { x: 0.313, y: 0.24, w: 0.314 },
};

export const courier: Photo = option("courier");
export const nightDoor: Photo = option("nightDoor");
export const phoneOnTable: Photo = option("phoneOnTable");
