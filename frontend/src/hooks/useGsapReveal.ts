import { useEffect, useRef } from 'react'

/**
 * Custom hook for GSAP scroll-triggered reveal animations.
 * Respects prefers-reduced-motion and cleans up on unmount.
 */
export function useGsapReveal() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Respect reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) {
            // Make all gsap-reveal elements visible without animation
            const els = containerRef.current?.querySelectorAll('.gsap-reveal, .gsap-reveal-up, .gsap-reveal-left')
            els?.forEach((el) => {
                const htmlEl = el as HTMLElement
                htmlEl.style.opacity = '1'
                htmlEl.style.transform = 'none'
            })
            return
        }

        let gsapModule: typeof import('gsap') | null = null
        let ScrollTriggerModule: any = null
        let ctx: any = null

        const init = async () => {
            try {
                const [gsapImport, stImport] = await Promise.all([
                    import('gsap'),
                    import('gsap/ScrollTrigger'),
                ])
                gsapModule = gsapImport
                ScrollTriggerModule = stImport.ScrollTrigger
                gsapModule.gsap.registerPlugin(ScrollTriggerModule)

                if (!containerRef.current) return

                ctx = gsapModule.gsap.context(() => {
                    // Fade-in reveals
                    gsapModule!.gsap.utils.toArray<HTMLElement>('.gsap-reveal').forEach((el) => {
                        gsapModule!.gsap.fromTo(el,
                            { opacity: 0 },
                            {
                                opacity: 1,
                                duration: 0.8,
                                ease: 'power2.out',
                                scrollTrigger: {
                                    trigger: el,
                                    start: 'top 85%',
                                    toggleActions: 'play none none none',
                                },
                            }
                        )
                    })

                    // Slide-up reveals
                    gsapModule!.gsap.utils.toArray<HTMLElement>('.gsap-reveal-up').forEach((el, i) => {
                        gsapModule!.gsap.fromTo(el,
                            { opacity: 0, y: 30 },
                            {
                                opacity: 1,
                                y: 0,
                                duration: 0.7,
                                delay: i * 0.08,
                                ease: 'power2.out',
                                scrollTrigger: {
                                    trigger: el,
                                    start: 'top 88%',
                                    toggleActions: 'play none none none',
                                },
                            }
                        )
                    })

                    // Slide-left reveals
                    gsapModule!.gsap.utils.toArray<HTMLElement>('.gsap-reveal-left').forEach((el) => {
                        gsapModule!.gsap.fromTo(el,
                            { opacity: 0, x: -30 },
                            {
                                opacity: 1,
                                x: 0,
                                duration: 0.7,
                                ease: 'power2.out',
                                scrollTrigger: {
                                    trigger: el,
                                    start: 'top 88%',
                                    toggleActions: 'play none none none',
                                },
                            }
                        )
                    })
                }, containerRef.current)
            } catch {
                // GSAP failed to load — make everything visible
                const els = containerRef.current?.querySelectorAll('.gsap-reveal, .gsap-reveal-up, .gsap-reveal-left')
                els?.forEach((el) => {
                    const htmlEl = el as HTMLElement
                    htmlEl.style.opacity = '1'
                    htmlEl.style.transform = 'none'
                })
            }
        }

        init()

        return () => {
            ctx?.revert()
        }
    }, [])

    return containerRef
}
