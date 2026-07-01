import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Owner } from "@/lib/types"

export function useOwners() {
  return useQuery<Owner[]>({
    queryKey: ["owners"],
    queryFn: async () => (await api.owners()).owners,
    staleTime: 300_000,
    retry: false,
  })
}
