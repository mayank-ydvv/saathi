/**
 * The 3–4 candidate photos for every picture slot on the page. The first option of each slot
 * is used unless a different one is chosen in the dev-only photo picker (`npm run dev`, then
 * the "Photos" button). Sources: free-licence Unsplash ("u:") and Pexels ("p:") photos.
 */
export type Face = { x: number; y: number; r: number };
export type Option = {
  label: string;
  src: string;
  focus?: string;
  /** Hero only: faces in the photo (fractions of width/height; r of width), keyed by family member. */
  faces?: Record<string, Face>;
  /** Hand only: the phone's rectangle in the photo, as fractions of the photo width. */
  screen?: { x: number; y: number; w: number };
};

export type Slot =
  | "hero"
  | "ma"
  | "papa"
  | "rahul"
  | "priya"
  | "aarav"
  | "neighbour"
  | "hand"
  | "courier"
  | "nightDoor"
  | "phoneOnTable";

export const OPTIONS: Record<Slot, Option[]> = {
  hero: [
    {
      label: "Grandparents laughing with grandson, garden",
      src: "p:18394078/pexels-photo-18394078.jpeg",
      faces: { papa: { x: 0.455, y: 0.395, r: 0.045 }, ma: { x: 0.59, y: 0.4, r: 0.042 }, aarav: { x: 0.675, y: 0.455, r: 0.04 } },
    },
    {
      label: "Family of five in the woods",
      src: "p:5163919/pexels-photo-5163919.jpeg",
      faces: {
        papa: { x: 0.345, y: 0.135, r: 0.035 },
        rahul: { x: 0.44, y: 0.14, r: 0.03 },
        ma: { x: 0.54, y: 0.157, r: 0.032 },
        priya: { x: 0.595, y: 0.14, r: 0.03 },
        aarav: { x: 0.33, y: 0.465, r: 0.032 },
      },
    },
    {
      label: "Four generations of women outdoors",
      src: "p:34572615/pexels-photo-34572615.jpeg",
      faces: {
        ma: { x: 0.215, y: 0.367, r: 0.055 },
        aarav: { x: 0.4, y: 0.38, r: 0.05 },
        priya: { x: 0.52, y: 0.25, r: 0.05 },
        neighbour: { x: 0.705, y: 0.25, r: 0.055 },
      },
    },
    {
      label: "Family together in a living room",
      src: "p:14769676/pexels-photo-14769676.jpeg",
      faces: { papa: { x: 0.2, y: 0.4, r: 0.05 }, rahul: { x: 0.485, y: 0.27, r: 0.035 }, ma: { x: 0.76, y: 0.27, r: 0.035 } },
    },
  ],
  ma: [
    { label: "Smiling, white sari", src: "p:2703082/pexels-photo-2703082.jpeg", focus: "50% 30%" },
    { label: "Laughing, glasses", src: "p:9069153/pexels-photo-9069153.jpeg", focus: "45% 22%" },
    { label: "Floral sari, garden", src: "u:photo-1560885673-4e2f056f6e2a", focus: "50% 22%" },
    { label: "Yellow sari, glasses", src: "u:photo-1774437790863-88a80bca5b29", focus: "50% 25%" },
  ],
  papa: [
    { label: "Seated by a window", src: "p:38544128/pexels-photo-38544128.jpeg", focus: "45% 25%" },
    { label: "White moustache, warm light", src: "u:photo-1582259181740-fcf033def7c8", focus: "50% 30%" },
    { label: "Glasses, pale wall", src: "u:photo-1698465281093-9f09159733b9", focus: "50% 30%" },
    { label: "Orange scarf, lane", src: "u:photo-1524081081171-7960da1de373", focus: "50% 25%" },
  ],
  rahul: [
    { label: "Studio, big smile", src: "u:photo-1757744705465-ea08b0ddc38a", focus: "50% 30%" },
    { label: "Laughing at home", src: "p:6102858/pexels-photo-6102858.jpeg", focus: "50% 25%" },
    { label: "Beach at dusk", src: "u:photo-1766162689608-b14a572cf9d4", focus: "50% 35%" },
    { label: "Evening lights", src: "u:photo-1758561274313-536bf1c4192c", focus: "50% 25%" },
  ],
  priya: [
    { label: "Sari, garden", src: "p:40407265/pexels-photo-40407265.jpeg", focus: "50% 25%" },
    { label: "Curly hair, festival", src: "u:photo-1774437890454-634d48db52c8", focus: "50% 30%" },
    { label: "Red sari, mustard field", src: "p:37951162/pexels-photo-37951162.jpeg", focus: "50% 20%" },
    { label: "Hills, knit top", src: "u:photo-1789500381106-ba13068a6520", focus: "50% 25%" },
  ],
  aarav: [
    { label: "Red woolly hat", src: "p:3494565/pexels-photo-3494565.jpeg", focus: "50% 30%" },
    { label: "Scarf, warm light", src: "p:12063535/pexels-photo-12063535.jpeg", focus: "50% 30%" },
    { label: "Checked shirt", src: "u:photo-1603185030522-05d4497bb180", focus: "50% 35%" },
    { label: "Big grin", src: "u:photo-1627579786743-8535db55dfe4", focus: "50% 30%" },
  ],
  neighbour: [
    { label: "Seated outdoors, dupatta", src: "p:38982379/pexels-photo-38982379.jpeg", focus: "50% 25%" },
    { label: "Gentle smile, scarf", src: "u:photo-1713078582993-fdd86b1a2c1f", focus: "50% 30%" },
    { label: "Green sari", src: "p:9366083/pexels-photo-9366083.jpeg", focus: "50% 30%" },
    { label: "White sari, city", src: "u:photo-1749189516333-168cfd97de0b", focus: "50% 30%" },
  ],
  hand: [
    // Local cut-outs (white backdrop removed) of Unsplash photo-1605188378873, Unsplash
    // photo-1545947597 and Pexels 8947174, so the hand sits on any background.
    { label: "Hand from below, right", src: "l:/hands/hand-1.webp", screen: { x: 0.313, y: 0.24, w: 0.314 } },
    { label: "Hand from below, left", src: "l:/hands/hand-2.webp", screen: { x: 0.4025, y: 0.31, w: 0.195 } },
    { label: "Raised hand, pink case", src: "l:/hands/hand-3.webp", screen: { x: 0.341, y: 0.4, w: 0.298 } },
  ],
  courier: [
    { label: "Courier knocking, parcel", src: "p:7363160/pexels-photo-7363160.jpeg", focus: "55% 40%" },
    { label: "Courier at a white door", src: "p:7362965/pexels-photo-7362965.jpeg", focus: "50% 50%" },
    { label: "Ringing the bell, clipboard", src: "p:6407628/pexels-photo-6407628.jpeg", focus: "60% 35%" },
    { label: "Hi-vis jacket at the door", src: "u:photo-1614791189661-93412a35af54", focus: "50% 40%" },
  ],
  nightDoor: [
    { label: "Warm-lit front door", src: "p:12748725/pexels-photo-12748725.jpeg", focus: "50% 50%" },
    { label: "Single lamp by the door", src: "p:17908462/pexels-photo-17908462.jpeg", focus: "50% 45%" },
    { label: "Porch light, steps", src: "p:9809606/pexels-photo-9809606.jpeg", focus: "50% 50%" },
    { label: "House front at night", src: "p:12700807/pexels-photo-12700807.jpeg", focus: "45% 50%" },
  ],
  phoneOnTable: [
    { label: "Phone on a chair in sun stripes", src: "u:photo-1697318694090-2135dec80fec", focus: "50% 55%" },
    { label: "Lock screen, coffee, sunglasses", src: "u:photo-1760346212530-ca616e9fde1b", focus: "30% 60%" },
    { label: "Phone in a shaft of light", src: "u:photo-1736879963353-d1078c8d455f", focus: "50% 50%" },
    { label: "Phone on a sunlit table", src: "u:photo-1585060514873-fe2710180762", focus: "50% 50%" },
  ],
};

const KEY = "saathi.landing.photos";

/** Index chosen per slot in the dev picker (empty in production builds). */
export function chosen(): Partial<Record<Slot, number>> {
  if (!import.meta.env.DEV) return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<Record<Slot, number>>;
  } catch {
    return {};
  }
}

export function choose(slot: Slot, index: number) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...chosen(), [slot]: index }));
  } catch {
    // Private mode: the picker just won't remember.
  }
}

export function option(slot: Slot): Option {
  const list = OPTIONS[slot];
  const pick = list[chosen()[slot] ?? 0] ?? list[0];
  if (!pick) throw new Error(`No photo options for ${slot}`);
  return pick;
}
