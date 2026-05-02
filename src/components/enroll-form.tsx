"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Two-stage enrollment:
 *   1. Paste a single-use bootstrap token (from server logs, Task 12 CLI)
 *      → POST /api/auth/bootstrap → enrollment cookie minted.
 *   2. Optional device nickname → POST /api/auth/register/options →
 *      browser runs WebAuthn registration ceremony →
 *      POST /api/auth/register/verify → session cookie set, redirect to /.
 */
export function EnrollForm() {
  const [token, setToken] = useState("");
  const [nickname, setNickname] = useState("");
  const [redeemed, setRedeemed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRedeem() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Token invalid");
      }
      setRedeemed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function onEnroll() {
    setError(null);
    setBusy(true);
    try {
      const optsRes = await fetch("/api/auth/register/options", { method: "POST" });
      if (!optsRes.ok) throw new Error("Failed to start enrollment");
      const { options, challengeId } = (await optsRes.json()) as {
        options: Parameters<typeof startRegistration>[0]["optionsJSON"];
        challengeId: string;
      };
      const response = await startRegistration({ optionsJSON: options });
      const verifyRes = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, response, nickname: nickname || undefined }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Enrollment failed");
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
        <CardTitle>Enroll a passkey for boink!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {!redeemed ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="token">Bootstrap token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="paste single-use token from server logs"
                autoComplete="off"
              />
            </div>
            <Button onClick={onRedeem} disabled={busy || !token.trim()} className="w-full">
              {busy ? "Validating…" : "Continue"}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="nickname">Device nickname (optional)</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. iPhone"
              />
            </div>
            <Button onClick={onEnroll} disabled={busy} className="w-full">
              {busy ? "Enrolling…" : "Create passkey"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
