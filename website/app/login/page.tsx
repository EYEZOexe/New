"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { CheckCircle2, DatabaseZap, LockKeyhole, Route, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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
  const [redirectTo, setRedirectTo] = useState("/dashboard");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectToRaw = params.get("redirectTo");
    if (typeof redirectToRaw === "string" && redirectToRaw.startsWith("/")) {
      setRedirectTo(redirectToRaw);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      console.info(`[auth/login] success email=${email.trim().toLowerCase()} redirect=${redirectTo}`);
      router.push(redirectTo);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Login failed";
      console.error(`[auth/login] failed email=${email.trim().toLowerCase()} message=${message}`);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageFrame>
      <SectionHeader
        badge="Access"
        title="Enter your trading workspace."
        subtitle="Authenticate once, then move directly into your dashboard, market modules, and Discord-link controls."
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
            <p className="site-kicker">Flow</p>
            <h2 className="text-2xl font-semibold tracking-tight">Fast entry, deterministic routing.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              After sign-in, you are routed to your intended page with session-backed Convex auth.
              This keeps dashboard, shop return state, and workspace modules in one identity model.
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
                  <Route className="size-3" />
                  Routed
                </Badge>
                <p className="text-sm text-foreground/90">Post-login destination is preserved so auth never breaks user flow.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <DatabaseZap className="size-3" />
                  Sources
                </Badge>
                <p className="text-sm text-foreground/90">Markets/news data is ingested server-side and streamed into Convex-backed modules.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <CheckCircle2 className="size-3" />
                  Clear
                </Badge>
                <p className="text-sm text-foreground/90">If access is blocked, the dashboard explains exactly why and where to fix it.</p>
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
