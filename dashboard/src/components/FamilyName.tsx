import { useState } from "react";
import { useFamilyName } from "../hooks/useFamilyName";
import { Icon } from "./Icon";

/** "Checking as Priya · Change": the name sent with "I'm checking". */
export function FamilyName() {
  const [name, setName] = useFamilyName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <Icon name="user" className="h-4 w-4" />
        <span className="min-w-0 break-words">
          Checking as <strong className="font-semibold text-ink">{name}</strong>
        </span>
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          className="ml-auto rounded-lg px-2 py-1 font-medium text-accent hover:bg-surface-2"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setName(draft);
        setEditing(false);
      }}
    >
      <label className="sr-only" htmlFor="family-name">
        Your name
      </label>
      <input
        id="family-name"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={40}
        autoFocus
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-sm"
      />
      <button type="submit" className="rounded-lg bg-accent px-3 py-1 text-sm font-medium text-accent-ink">
        Save
      </button>
    </form>
  );
}
