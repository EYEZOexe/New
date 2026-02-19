"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight, CheckCircle2, Rocket, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { MarketingFrame } from "@/components/site/marketing-frame";
import { MarketingNav } from "@/components/site/marketing-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const signupSteps = [
  "Create your account with email and password.",
  "Choose a plan and complete checkout.",
  "Start using signals and journal tools immediately.",
] as const;

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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_430px] xl:items-start">
        <Card className="rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-8">
          <CardContent className="space-y-7 px-0">
            <div className="space-y-4">
              <Badge variant="secondary" className="w-fit rounded-full bg-cyan-500/20 text-cyan-100">
                Start Your Access
              </Badge>
              <h1 className="site-title text-4xl md:text-6xl">Create your account and start trading smarter.</h1>
              <p className="site-subtitle max-w-2xl">
                Join in minutes, activate your plan, and move into a structured workspace designed for
                execution consistency.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <WalletCards className="size-4 text-cyan-300" />
                  Flexible plan options
                </p>
                <p className="mt-2 text-sm text-muted-foreground">Choose your tier and duration based on your current trading pace.</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Rocket className="size-4 text-cyan-300" />
                  Quick onboarding
                </p>
                <p className="mt-2 text-sm text-muted-foreground">From signup to dashboard access with minimal friction.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
              <p className="site-kicker">Getting started</p>
              <div className="mt-3 space-y-2">
                {signupSteps.map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="size-4 text-cyan-300" />
                    {item}
                  </p>
                ))}
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
