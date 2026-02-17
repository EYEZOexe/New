import Link from "next/link";
import type { FormEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <Card className="site-panel w-full max-w-lg">
      <CardHeader className="space-y-2 px-0 pb-2">
        <CardTitle className="text-2xl">{isLogin ? "Log in" : "Sign up"}</CardTitle>
        <CardDescription>
          {isLogin
            ? "Sign in with your email and password."
            : "Create your account and unlock your dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 px-0">
        <form onSubmit={props.onSubmit} className="space-y-5">
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
              className="h-11 rounded-xl bg-background/60"
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
              className="h-11 rounded-xl bg-background/60"
              onChange={(event) => props.onPasswordChange(event.target.value)}
            />
          </div>

          {props.error ? (
            <Alert variant="destructive">
              <AlertDescription>{props.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={props.isSubmitting} className="h-11 w-full rounded-xl text-sm font-semibold">
            {props.isSubmitting
              ? isLogin
                ? "Logging in..."
                : "Creating account..."
              : isLogin
                ? "Log in"
                : "Sign up"}
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
