"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Sign-out button. POSTs to /api/auth/logout (which is idempotent and
 * public per the proxy allowlist), then hard-navigates to /login so the
 * cleared cookie takes effect on the next request.
 */
export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      {busy ? "Signing out…" : "Sign out"}
    </Button>
  );
}
