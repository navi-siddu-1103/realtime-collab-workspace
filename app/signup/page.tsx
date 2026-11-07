"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import AuthShell from "@/components/AuthShell";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get("name")),
      email: String(f.get("email")),
      password: String(f.get("password")),
    };
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Could not create the account.");
      setPending(false);
      return;
    }
    await signIn("credentials", { email: body.email, password: body.password, redirect: false });
    router.push("/dashboard");
  }

  return (
    <AuthShell
      title="Create your account"
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="text-ink underline underline-offset-4">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <input name="name" required autoComplete="name" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Password</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="field" />
          <span className="block text-xs text-muted">At least 8 characters.</span>
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button disabled={pending} className="btn btn-primary w-full">
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}