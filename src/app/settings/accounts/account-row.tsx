"use client";

import { useState } from "react";
import type { Account } from "@/lib/db/schema";

interface Props {
  account: Account;
}

export function AccountRow({ account: acct }: Props) {
  const [name, setName] = useState(acct.name);
  const [isLiquid, setIsLiquid] = useState(acct.isLiquid);
  const [isActive, setIsActive] = useState(acct.isActive);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(acct.name);

  async function save(patch: Partial<{ name: string; isLiquid: boolean; isActive: boolean }>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${acct.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      if (patch.name !== undefined) setName(patch.name);
      if (patch.isLiquid !== undefined) setIsLiquid(patch.isLiquid);
      if (patch.isActive !== undefined) setIsActive(patch.isActive);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  return (
    <div className={`p-3 ${!isActive ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              className="border-border-subtle bg-surface flex-1 rounded border px-2 py-1 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <button
              disabled={saving}
              onClick={() => save({ name: draft })}
              className="bg-primary text-primary-foreground rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
            >
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-fg-muted text-xs">
              Cancel
            </button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{name}</p>
            <p className="text-fg-muted mt-0.5 text-xs">
              {acct.currency} · {acct.kind}
              {isLiquid ? " · liquid" : ""}
              {!isActive ? " · archived" : ""}
            </p>
          </div>
        )}

        {!editing && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => {
                setDraft(name);
                setEditing(true);
              }}
              className="text-fg-muted hover:text-fg-default text-xs"
            >
              Rename
            </button>
            <button
              disabled={saving}
              onClick={() => save({ isLiquid: !isLiquid })}
              className="text-fg-muted hover:text-fg-default text-xs"
            >
              {isLiquid ? "Mark illiquid" : "Mark liquid"}
            </button>
            <button
              disabled={saving}
              onClick={() => save({ isActive: !isActive })}
              className="text-fg-muted hover:text-fg-default text-xs"
            >
              {isActive ? "Archive" : "Restore"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
