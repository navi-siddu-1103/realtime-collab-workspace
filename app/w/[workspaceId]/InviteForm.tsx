"use client";
import { useActionState } from "react";
import { inviteMember } from "./actions";

type State = { error?: string; ok?: string } | null;

export default function InviteForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<State, FormData>(
    inviteMember.bind(null, workspaceId),
    null
  );

  return (
    <div className="space-y-2">
      <form action={action} className="flex gap-2">
        <input name="email" type="email" required placeholder="Invite by email" className="flex-1 rounded border p-2" />
        <select name="role" className="rounded border bg-black p-2">
          <option value="EDITOR">EDITOR</option>
          <option value="COMMENTER">COMMENTER</option>
          <option value="VIEWER">VIEWER</option>
        </select>
        <button disabled={pending} className="rounded bg-white px-3 text-black disabled:opacity-50">
          {pending ? "Inviting…" : "Invite"}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-500">{state.ok}</p>}
      <p className="text-sm text-gray-500">The person must have signed up first.</p>
    </div>
  );
}