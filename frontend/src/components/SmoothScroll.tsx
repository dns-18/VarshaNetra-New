import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Lenis smooth-scroll wrapper.
 * Auto-disables on pages with Leaflet maps and when prefers-reduced-motion is active.
 */

// Pages where smooth scroll should NOT run (Leaflet maps, etc.)
const DISABLED_PATHS = ['/', '/map']

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
    const location = useLocation()
    const lenisRef = useRef<any>(null)

    useEffect(() => {
        // Respect reduced motion
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) return

        // Don't enable on map pages
        if (DISABLED_PATHS.includes(location.pathname)) {
            lenisRef.current?.destroy()
            lenisRef.current = null
            return
        }

        let raf: number
        let lenis: any

        const init = async () => {
            try {
                const { default: Lenis } = await import('lenis')

                lenis = new Lenis({
                    duration: 1.1,
                    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                    touchMultiplier: 1.5,
                })

                lenisRef.current = lenis

                // Connect Lenis to GSAP ScrollTrigger if available
                try {
                    const { gsap } = await import('gsap')
                    const { ScrollTrigger } = await import('gsap/ScrollTrigger')
                    gsap.registerPlugin(ScrollTrigger)
                    lenis.on('scroll', ScrollTrigger.update)
                    gsap.ticker.add((time: number) => {
                        lenis.raf(time * 1000)
                    })
                    gsap.ticker.lagSmoothing(0)
                } catch {
                    // GSAP not available — use requestAnimationFrame
                    function rafLoop(time: number) {
                        lenis.raf(time)
                        raf = requestAnimationFrame(rafLoop)
                    }
                    raf = requestAnimationFrame(rafLoop)
                }
            } catch {
                // Lenis failed to load — fallback to native scroll
            }
        }

        init()

        return () => {
            if (raf) cancelAnimationFrame(raf)
            lenisRef.current?.destroy()
            lenisRef.current = null
        }
    }, [location.pathname])

    return <>{children}</>
}
