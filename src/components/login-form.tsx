"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Discoverable-credential login. /api/auth/login/options returns the
 * WebAuthn challenge; the browser picks a passkey via
 * navigator.credentials.get; /api/auth/login/verify validates the
 * assertion, mints a session, sets the session cookie. On success,
 * hard-navigate to / so the new cookie hits the proxy.
 */
export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setError(null);
    setBusy(true);
    try {
      const optsRes = await fetch("/api/auth/login/options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start login");
      const { options, challengeId } = (await optsRes.json()) as {
        options: Parameters<typeof startAuthentication>[0]["optionsJSON"];
        challengeId: string;
      };
      const response = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Login failed");
      }
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to boink!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Sign-in error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={onLogin} disabled={busy} className="w-full">
          {busy ? "Authenticating…" : "Sign in with passkey"}
        </Button>
        <p className="text-fg-muted text-sm">
          First time?{" "}
          <a className="underline" href="/enroll">
            Enroll a passkey using a bootstrap token
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
