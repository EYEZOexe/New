"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AuthFormCard } from "@/components/site/auth-form-card";
import { PageFrame } from "@/components/site/page-frame";
import { SectionHeader } from "@/components/site/section-header";

export default function SignupPage() {
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
      await signIn("password", { email, password, flow: "signUp" });
      router.push("/dashboard");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Signup failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageFrame>
      <SectionHeader
        badge="Onboarding"
        title="Create your trader console account."
        subtitle="Get immediate access to shop tiers, entitlement state tracking, and live dashboard visibility controls."
        navLinks={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Shop" },
        ]}
      />
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
    </PageFrame>
  );
}
