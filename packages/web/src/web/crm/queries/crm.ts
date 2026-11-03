import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useRecords() {
  return useQuery(orpc.crm.list.queryOptions({ refetchInterval: 60000 }));
}
export function useSave() {
  const q = useQueryClient();
  return useMutation(
    orpc.crm.save.mutationOptions({
      onSuccess: () => q.invalidateQueries({ queryKey: orpc.crm.key() }),
    }),
  );
}
export function useRemove() {
  const q = useQueryClient();
  return useMutation(
    orpc.crm.remove.mutationOptions({
      onSuccess: () => q.invalidateQueries({ queryKey: orpc.crm.key() }),
    }),
  );
}
