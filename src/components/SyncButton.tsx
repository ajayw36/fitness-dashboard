"use client";

import { useState, useTransition } from "react";
import { syncNow } from "@/app/actions";

export function SyncButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const res = await syncNow();
            setMsg(res.ok ? "Synced" : `Error: ${res.error}`);
          })
        }
        disabled={pending}
        className="rounded-md border border-border-strong bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-text transition hover:border-lime/50 hover:text-lime disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
