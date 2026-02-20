import Link from "next/link";
import type { FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormCardProps = {
  mode: "login" | "signup";
  email: string;
  password: string;
  isSubmitting: boolean;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthFormCard(props: AuthFormCardProps) {
  const isLogin = props.mode === "login";

  return (
    <Card className="site-card-hover h-fit w-full rounded-3xl border border-border/70 bg-card/90 p-6 shadow-[0_32px_90px_-65px_rgba(14,170,231,0.95)] backdrop-blur-xl md:p-7">
      <CardHeader className="space-y-3 px-0 pb-1">
        <Badge variant="secondary" className="w-fit rounded-full border border-cyan-300/30 bg-cyan-400/15 text-cyan-100">
          {isLogin ? "Member Login" : "Start Your Account"}
        </Badge>
        <CardTitle className="text-3xl leading-tight tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</CardTitle>
        <CardDescription>
          {isLogin
            ? "Enter your account details to continue."
            : "Use your email and password to get started."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 px-0 pt-4">
        <form onSubmit={props.onSubmit} className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="auth-email" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Email
            </Label>
            <Input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={props.email}
              className="h-11 rounded-xl bg-background/70"
              onChange={(event) => props.onEmailChange(event.target.value)}
            />
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="auth-password" className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Password
            </Label>
            <Input
              id="auth-password"
              type="password"
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={props.password}
              className="h-11 rounded-xl bg-background/70"
              onChange={(event) => props.onPasswordChange(event.target.value)}
            />
          </div>

          {props.error ? (
            <Alert variant="destructive">
              <AlertDescription>{props.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={props.isSubmitting} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold">
            {props.isSubmitting
              ? isLogin
                ? "Logging in..."
                : "Creating account..."
              : isLogin
                ? "Log in"
                : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          {isLogin ? "Need an account? " : "Already have an account? "}
          <Link
            href={isLogin ? "/signup" : "/login"}
            className="font-semibold text-foreground underline underline-offset-4"
          >
            {isLogin ? "Sign up" : "Log in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
