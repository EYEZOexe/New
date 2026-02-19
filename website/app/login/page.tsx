"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight, LockKeyhole, Route, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
        <Card className="site-panel">
          <CardContent className="space-y-6 px-0">
            <div className="space-y-3">
              <p className="site-kicker">Flow</p>
              <h2 className="text-2xl font-semibold tracking-tight">Fast entry, deterministic routing.</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              After sign-in, you are routed to your intended page with session-backed Convex auth.
              This keeps dashboard, shop return state, and workspace modules in one identity model.
            </p>

            <div className="space-y-2 rounded-2xl border border-border/70 bg-background/25 p-4">
              <div className="flex items-center gap-2 text-sm">
                <LockKeyhole className="size-4 text-cyan-300" />
                Password-based auth backed by Convex identity.
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Zap className="size-4 text-cyan-300" />
                Realtime account state across all workspace pages.
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Route className="size-4 text-cyan-300" />
                Redirect target is preserved after successful login.
              </div>
            </div>

            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/shop">
                View plans first
                <ArrowRight className="size-4" />
              </Link>
            </Button>
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
