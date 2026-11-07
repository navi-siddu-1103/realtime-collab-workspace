"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const f = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(f.get("email")),
      password: String(f.get("password")),
      redirect: false,
    });
    setPending(false);
    if (res?.error) setError("That email and password don’t match an account.");
    else router.push("/dashboard");
  }

  return (
    <AuthShell
      title="Welcome back"
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Password</span>
          <input name="password" type="password" required autoComplete="current-password" className="field" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button disabled={pending} className="btn btn-primary w-full">
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}