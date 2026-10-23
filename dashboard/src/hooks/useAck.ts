import { useState } from "react";
import { ackAlert } from "../api/client";
import type { Alert } from "../api/types";
import { useToast } from "../state/Toast";
import { useFamilyName } from "./useFamilyName";

/** "I'm checking": POST /alerts/{id}/ack as family, then a confirmation toast. */
export function useAck(alert: Alert | null, onAcked: () => void) {
  const [name] = useFamilyName();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function ack() {
    if (!alert) return;
    setSending(true);
    setFailed(false);
    const result = await ackAlert(alert.alert_id, { by: "family", name });
    setSending(false);
    if (result.ok) {
      toast.show(`Thanks, ${name}. Everyone can see you're checking.`);
      onAcked();
    } else {
      setFailed(true);
    }
  }

  return { ack, sending, failed };
}
