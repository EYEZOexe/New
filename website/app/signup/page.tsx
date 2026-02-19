"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowRight, BadgeCheck, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";
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
      console.info(`[auth/signup] success email=${email.trim().toLowerCase()} redirect=${redirectTo}`);
      router.push(redirectTo);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Signup failed";
      console.error(`[auth/signup] failed email=${email.trim().toLowerCase()} message=${message}`);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageFrame>
      <SectionHeader
        badge="Onboarding"
        title="Create your workspace identity."
        subtitle="Set up account access first, then continue into plan selection and dashboard activation."
        navLinks={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
        <Card className="site-panel">
          <CardContent className="space-y-6 px-0">
            <div className="space-y-3">
              <p className="site-kicker">Sequence</p>
              <h2 className="text-2xl font-semibold tracking-tight">Create account, choose plan, unlock feeds.</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Signup creates your persistent user identity so payment events, entitlements, and
              dashboard visibility rules stay synchronized from checkout through live feed access.
            </p>

            <div className="space-y-2 rounded-2xl border border-border/70 bg-background/25 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Wallet className="size-4 text-cyan-300" />
                Select a tier and duration from the catalog.
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BadgeCheck className="size-4 text-cyan-300" />
                Checkout return confirms active entitlement state.
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="size-4 text-cyan-300" />
                Dashboard visibility is applied from your tier rules.
              </div>
            </div>

            <Button asChild variant="outline" className="w-fit rounded-full">
              <Link href="/shop">
                Browse plans
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
      </div>
    </PageFrame>
  );
}
