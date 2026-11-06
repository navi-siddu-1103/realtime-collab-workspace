"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      setError((await res.json()).error ?? "Signup failed");
      return;
    }
    await signIn("credentials", { email: body.email, password: body.password, redirect: false });
    router.push("/dashboard");
  }

  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold">Create account</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="name" placeholder="Name" required className="w-full rounded border p-2" />
        <input name="email" type="email" placeholder="Email" required className="w-full rounded border p-2" />
        <input name="password" type="password" placeholder="Password (min 8)" required minLength={8} className="w-full rounded border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-black p-2 text-white">Sign up</button>
      </form>
      <p className="text-sm">Have an account? <Link href="/login" className="underline">Log in</Link></p>
    </main>
  );
}