import { Suspense, lazy, type SVGProps } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HeroBackground = lazy(() =>
  import("@/components/hero-background").then((m) => ({ default: m.HeroBackground }))
)

const PIXEL_COLOR = "#8573e4"

const fallbackGradient =
  "h-full w-full bg-[radial-gradient(60%_55%_at_50%_30%,color-mix(in_oklch,var(--primary),transparent_80%)_0%,transparent_72%)]"

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function LoginScreen() {
  const authError = new URLSearchParams(window.location.search).get("auth") === "error"

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div aria-hidden className={fallbackGradient} />}>
          <HeroBackground color={PIXEL_COLOR} />
        </Suspense>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(62%_55%_at_50%_44%,color-mix(in_oklch,var(--background),transparent_20%)_0%,color-mix(in_oklch,var(--background),transparent_60%)_46%,transparent_80%)]"
      />

      <div className="pointer-events-none relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-legible font-pixel text-5xl tracking-tight text-foreground sm:text-6xl">
          purgegit
        </h1>

        <p className="text-legible mt-5 text-base text-foreground/80 sm:text-lg">
          clean up your github. make old public repos private, archive, or delete them — in bulk.
        </p>

        <div className="pointer-events-auto mt-10">
          <a className={cn(buttonVariants(), "h-11 gap-2 rounded-lg px-6 text-sm")} href="/api/auth/login">
            <GithubIcon className="size-4" />
            sign in with github
          </a>
        </div>

        {authError && (
          <p className="text-legible mt-4 text-sm text-destructive">sign-in failed. please try again.</p>
        )}

        <a
          href="https://github.com/genericness/purgegit"
          target="_blank"
          rel="noreferrer noopener"
          className="text-legible pointer-events-auto mt-10 text-xs text-foreground/55 underline-offset-4 transition-colors hover:text-foreground/85 hover:underline"
        >
          open source
        </a>
      </div>
    </main>
  )
}
