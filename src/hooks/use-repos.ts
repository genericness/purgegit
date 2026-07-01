import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Owner, Repo } from "@/lib/types"

export function useRepos(owner: Owner | null) {
  return useQuery<Repo[]>({
    queryKey: ["repos", owner?.login],
    queryFn: async () => (await api.repos(owner ?? undefined)).repos,
    enabled: !!owner,
    staleTime: 30_000,
    retry: false,
  })
}
