import { useWorkspace } from "../../lib/workspace";
export const authClient = {
  useSession: () => ({ data: { user: useWorkspace().user } }),
  signOut: async () => {
    await fetch("/api/workspace/logout", { method: "POST" });
    window.location.assign("/");
  },
};
