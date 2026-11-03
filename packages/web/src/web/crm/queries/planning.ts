import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useAppendPlan() {
  const q = useQueryClient();
  return useMutation(
    orpc.planning.append.mutationOptions({
      onSuccess: () => q.invalidateQueries({ queryKey: orpc.crm.key() }),
    }),
  );
}
