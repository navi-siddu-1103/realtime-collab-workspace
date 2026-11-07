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
      <form action={action} className="flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="Email of someone who has an account"
          aria-label="Email"
          className="field min-w-0 flex-1"
        />
        <select name="role" aria-label="Role" className="field w-auto">
          <option value="EDITOR">Editor</option>
          <option value="COMMENTER">Commenter</option>
          <option value="VIEWER">Viewer</option>
        </select>
        <button disabled={pending} className="btn btn-primary">
          {pending ? "Adding…" : "Add member"}
        </button>
      </form>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="text-sm text-ok">{state.ok}</p>}
    </div>
  );
}