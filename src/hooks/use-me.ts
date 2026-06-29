import { useQuery } from "@tanstack/react-query"
import { api, ApiError } from "@/lib/api"
import type { Me } from "@/lib/types"

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.me()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null
        throw err
      }
    },
    retry: false,
    staleTime: 60_000,
  })
}
