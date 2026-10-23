import { Eye, House, Users, Volume2, type LucideIcon } from "lucide-react";
import type { AlertState } from "../api/types";

/** The escalation ladder before it resolves (contract: SUSPECT → … → ALERT_NEIGHBOUR). */
export const LADDER: { state: AlertState; short: string; icon: LucideIcon }[] = [
  { state: "SUSPECT", short: "Noticed", icon: Eye },
  { state: "NUDGE_PARENT", short: "Voice nudge", icon: Volume2 },
  { state: "ALERT_FAMILY", short: "Family", icon: Users },
  { state: "ALERT_NEIGHBOUR", short: "Neighbour", icon: House },
];
