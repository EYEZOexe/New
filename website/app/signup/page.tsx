"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
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
import { sanitizeAppRedirectPath } from "@/lib/redirectPath";
import { toUserFacingAuthError } from "@/lib/userFacingErrors";

const signupSteps = [
  "Create your account with email and password.",
  "Choose a plan and complete checkout.",
  "Start using signals and journal tools immediately.",
] as const;

export default function SignupPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState("/shop");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectToRaw = params.get("redirectTo");
    setRedirectTo(sanitizeAppRedirectPath(redirectToRaw, "/shop"));
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    router.replace(redirectTo);
  }, [isAuthenticated, isLoading, redirectTo, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await signIn("password", { email, password, flow: "signUp" });
      router.replace(redirectTo);
    } catch (submitError) {
      setError(toUserFacingAuthError(submitError, "signup"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MarketingFrame>
      <MarketingNav />

      <section className="mx-auto grid w-full max-w-5xl gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] xl:items-start">
        <div className="site-animate-in w-full max-w-[460px] justify-self-center xl:justify-self-start">
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
        </div>

        <Card className="site-animate-in site-animate-in-delay-1 site-card-hover rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-7">
          <CardContent className="space-y-6 px-0">
            <div className="space-y-3">
              <Badge variant="secondary" className="w-fit rounded-full bg-cyan-500/20 text-cyan-100">
                Start Your Access
              </Badge>
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Create your G3n S1gnals account.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Join in minutes, activate your plan, and move into a structured workspace built for
                consistent execution.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="site-soft">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <WalletCards className="size-4 text-cyan-300" />
                  Flexible plan options
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Choose tier and duration based on your current trading pace.
                </p>
              </div>
              <div className="site-soft">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Rocket className="size-4 text-cyan-300" />
                  Quick onboarding
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Go from account creation to dashboard access with minimal friction.
                </p>
              </div>
            </div>

            <div className="site-soft">
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
      </section>
    </MarketingFrame>
  );
}
