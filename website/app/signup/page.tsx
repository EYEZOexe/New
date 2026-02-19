"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight, BadgeCheck, BarChart3, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState("/shop");

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
      await signIn("password", { email, password, flow: "signUp" });
      router.push(redirectTo);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Signup failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MarketingFrame>
      <MarketingNav />

      <section className="grid gap-6 xl:grid-cols-[1fr_460px] xl:items-start">
        <Card className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-8">
          <CardContent className="space-y-6 px-0">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Create account</p>
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Start trading with structure today.</h1>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                Set up your account in less than a minute, choose a plan, and get immediate access to the trading workspace.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Wallet className="size-4 text-cyan-300" />
                  Pick a plan
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <BadgeCheck className="size-4 text-cyan-300" />
                  Instant activation
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <BarChart3 className="size-4 text-cyan-300" />
                  Track performance
                </div>
              </div>
            </div>

            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/shop">
                Compare plans
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <AuthFormCard
          mode="signup"
          email={email}
          password={password}
          isSubmitting={isSubmitting}
          error={error}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onSubmit={onSubmit}
        />
      </section>
    </MarketingFrame>
  );
}
