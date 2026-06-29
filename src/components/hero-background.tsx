import { useEffect, useState } from "react"
import PixelBlast from "@/components/PixelBlast"

export function HeroBackground({ color }: { color: string }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setAnimate(!mq.matches)
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [])

  if (!animate) {
    return (
      <div
        aria-hidden
        className="h-full w-full bg-[radial-gradient(60%_55%_at_50%_30%,color-mix(in_oklch,var(--primary),transparent_80%)_0%,transparent_72%)]"
      />
    )
  }

  return (
    <PixelBlast
      variant="square"
      color={color}
      pixelSize={4}
      patternScale={2.4}
      patternDensity={1.3}
      pixelSizeJitter={0.45}
      enableRipples
      rippleSpeed={0.32}
      rippleThickness={0.1}
      rippleIntensityScale={1.4}
      edgeFade={0}
      speed={0.5}
      transparent
    />
  )
}
