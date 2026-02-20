"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
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

const loginBenefits = [
  "See live signal context and your modules in one view.",
  "Continue your journal workflow with no setup friction.",
  "Move from login to dashboard in seconds.",
] as const;

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
    setRedirectTo(sanitizeAppRedirectPath(redirectToRaw, "/dashboard"));
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await signIn("password", { email, password, flow: "signIn" });
      router.push(redirectTo);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Login failed";
      setError(message);
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

        <Card className="site-animate-in site-animate-in-delay-1 site-card-hover rounded-3xl border border-border/70 bg-card/85 p-6 backdrop-blur-xl md:p-7">
          <CardContent className="space-y-6 px-0">
            <div className="space-y-3">
              <Badge variant="secondary" className="w-fit rounded-full bg-cyan-500/20 text-cyan-100">
                Welcome Back
              </Badge>
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
                Welcome back to G3n S1gnals.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Sign in and continue with your dashboard, market tools, and journal workflow without
                resetting your setup.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="site-soft">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="size-4 text-cyan-300" />
                  Secure account access
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Credentials protect workspace visibility and saved activity.
                </p>
              </div>
              <div className="site-soft">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRight className="size-4 text-cyan-300" />
                  Fast route to dashboard
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  After sign-in, you land directly inside your member workspace.
                </p>
              </div>
            </div>

            <div className="site-soft">
              <p className="site-kicker">What you get right away</p>
              <div className="mt-3 space-y-2">
                {loginBenefits.map((item) => (
                  <p key={item} className="flex items-center gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="size-4 text-cyan-300" />
                    {item}
                  </p>
                ))}
              </div>
            </div>

            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/shop">View plans</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </MarketingFrame>
  );
}
