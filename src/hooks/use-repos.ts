import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Repo } from "@/lib/types"

export function useRepos(enabled: boolean) {
  return useQuery<Repo[]>({
    queryKey: ["repos"],
    queryFn: async () => (await api.repos()).repos,
    enabled,
    staleTime: 30_000,
    retry: false,
  })
}
