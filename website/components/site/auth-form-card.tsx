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
    <Card className="site-panel mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{isLogin ? "Log in" : "Sign up"}</CardTitle>
        <CardDescription>
          {isLogin
            ? "Sign in with your email and password."
            : "Create your account and unlock your dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={props.onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              required
              value={props.email}
              onChange={(event) => props.onEmailChange(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              required
              value={props.password}
              onChange={(event) => props.onPasswordChange(event.target.value)}
            />
          </div>

          {props.error ? (
            <Alert variant="destructive">
              <AlertDescription>{props.error}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" disabled={props.isSubmitting} className="w-full">
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
