import { Loader2Icon } from "lucide-react"
import { useMe } from "@/hooks/use-me"
import { LoginScreen } from "@/components/login-screen"
import { Dashboard } from "@/components/dashboard"

export function App() {
  const { data: me, isLoading } = useMe()

  if (isLoading) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!me) return <LoginScreen />

  return <Dashboard me={me} />
}
