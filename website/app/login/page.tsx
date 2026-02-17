"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { CheckCircle2, LockKeyhole, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Login failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageFrame>
      <SectionHeader
        badge="Access"
        title="Return to your signal workspace."
        subtitle="Sign in to access tier-gated dashboard feeds, checkout return status, and Discord link controls."
        navLinks={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
        ]}
        highlights={[
          { label: "Auth", value: "Convex password flow" },
          { label: "Sync", value: "Realtime entitlement" },
          { label: "Controls", value: "Dashboard + Discord" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <Card className="site-panel">
          <CardContent className="space-y-5 px-0">
            <p className="site-kicker">Why this flow</p>
            <h2 className="text-2xl font-semibold tracking-tight">Fast access, no extra friction.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign in once and everything stays in one workspace: subscription status, channel
              visibility, and Discord role/link state.
            </p>

            <div className="space-y-3">
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <LockKeyhole className="size-3" />
                  Secure
                </Badge>
                <p className="text-sm text-foreground/90">Password-based auth backed by Convex identity.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <Zap className="size-3" />
                  Live
                </Badge>
                <p className="text-sm text-foreground/90">Account state refreshes in realtime across pages.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <CheckCircle2 className="size-3" />
                  Clear
                </Badge>
                <p className="text-sm text-foreground/90">If access is blocked, the dashboard explains exactly why.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <AuthFormCard
          mode="login"
          email={email}
          password={password}
          isSubmitting={isSubmitting}
          error={error}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={onSubmit}
        />
      </div>
    </PageFrame>
  );
}
