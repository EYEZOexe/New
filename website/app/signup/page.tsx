"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { BadgeCheck, CheckCircle2, Sparkles, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";
import { Badge } from "@/components/ui/badge";
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
        highlights={[
          { label: "Onboarding", value: "Under 1 minute" },
          { label: "Commerce", value: "Tier + duration plans" },
          { label: "Outcome", value: "Dashboard access control" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <Card className="site-panel">
          <CardContent className="space-y-5 px-0">
            <p className="site-kicker">Sequence</p>
            <h2 className="text-2xl font-semibold tracking-tight">Create account, choose plan, unlock feeds.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Signup creates your persistent user identity so payment events, entitlements, and
              dashboard visibility rules stay synchronized from checkout through live feed access.
            </p>

            <div className="space-y-3">
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <Wallet className="size-3" />
                  Billing
                </Badge>
                <p className="text-sm text-foreground/90">Select a tier and duration from the shop catalog.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <BadgeCheck className="size-3" />
                  Entitlement
                </Badge>
                <p className="text-sm text-foreground/90">Checkout return confirms status before feed access opens.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <Sparkles className="size-3" />
                  Visibility
                </Badge>
                <p className="text-sm text-foreground/90">Dashboard shows exactly what channels your tier can view.</p>
              </div>
              <div className="site-soft flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">
                  <CheckCircle2 className="size-3" />
                  Journal
                </Badge>
                <p className="text-sm text-foreground/90">Trading journal tools activate immediately once your account is in place.</p>
              </div>
            </div>
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
