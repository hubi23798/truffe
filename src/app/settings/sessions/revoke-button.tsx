"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  sessionId: string;
  label?: string;
}

export function RevokeButton({ sessionId, label }: Props) {
  const [loading, setLoading] = useState(false);

  async function revoke() {
    setLoading(true);
    const url = sessionId === "all" ? "/api/auth/logout" : `/api/sessions/${sessionId}`;
    const method = sessionId === "all" ? "POST" : "DELETE";
    await fetch(url, { method });
    window.location.href = sessionId === "all" ? "/login" : "/settings/sessions";
  }

  return (
    <Button variant="outline" size="sm" disabled={loading} onClick={revoke}>
      {loading ? "…" : (label ?? "Revoke")}
    </Button>
  );
}
