"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(f.get("email")),
      password: String(f.get("password")),
      redirect: false,
    });
    if (res?.error) setError("Invalid email or password");
    else router.push("/dashboard");
  }

  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="email" type="email" placeholder="Email" required className="w-full rounded border p-2" />
        <input name="password" type="password" placeholder="Password" required className="w-full rounded border p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-black p-2 text-white">Log in</button>
      </form>
      <p className="text-sm">No account? <Link href="/signup" className="underline">Sign up</Link></p>
    </main>
  );
}