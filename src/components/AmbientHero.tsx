import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'

export function AmbientHero() {
  const fieldRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const smoothX = useSpring(pointerX, { stiffness: 45, damping: 22, mass: 0.8 })
  const smoothY = useSpring(pointerY, { stiffness: 45, damping: 22, mass: 0.8 })
  const farX = useTransform(smoothX, [-1, 1], [-5, 5])
  const farY = useTransform(smoothY, [-1, 1], [-4, 4])
  const nearX = useTransform(smoothX, [-1, 1], [7, -7])
  const nearY = useTransform(smoothY, [-1, 1], [5, -5])
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 280, 760], reducedMotion ? [1, 1, 1] : [1, 0.76, 0.12])

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const depth = latest < 120 ? 'hero' : latest < 480 ? 'retreat' : 'rest'
    const field = fieldRef.current
    if (field && field.dataset.scrollDepth !== depth) field.dataset.scrollDepth = depth
    if (document.documentElement.dataset.motionDepth !== depth) document.documentElement.dataset.motionDepth = depth
  })

  useEffect(() => {
    const depth = window.scrollY < 120 ? 'hero' : window.scrollY < 480 ? 'retreat' : 'rest'
    document.documentElement.dataset.motionDepth = depth
    return () => {
      delete document.documentElement.dataset.motionDepth
    }
  }, [])

  useEffect(() => {
    if (reducedMotion || !window.matchMedia('(pointer: fine)').matches) return

    const updatePointer = (event: PointerEvent) => {
      const field = fieldRef.current
      if (!field || field.dataset.scrollDepth === 'rest') {
        pointerX.set(0)
        pointerY.set(0)
        return
      }
      const bounds = field.getBoundingClientRect()
      if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        pointerX.set(0)
        pointerY.set(0)
        return
      }

      pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 2)
      pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 2)
    }

    window.addEventListener('pointermove', updatePointer, { passive: true })
    return () => window.removeEventListener('pointermove', updatePointer)
  }, [pointerX, pointerY, reducedMotion])

  return (
    <motion.div ref={fieldRef} className="ambient-hero-field" data-scroll-depth="hero" style={{ opacity }} aria-hidden="true">
      <motion.div className="ambient-glow ambient-glow-violet" style={{ x: farX, y: farY }} />
      <motion.div className="ambient-glow ambient-glow-blue" style={{ x: nearX, y: nearY }} />
      <svg className="ambient-network" viewBox="0 0 760 640" fill="none" focusable="false">
        <g className="ambient-network-lines">
          <path d="M85 114 218 188 365 103 493 207 665 123M218 188l40 190 185-80 50 177 172-105M365 103l78 195M258 378l-125 116 235 62 125-159" />
        </g>
        <g className="ambient-network-nodes">
          <circle cx="85" cy="114" r="2" /><circle cx="218" cy="188" r="3" /><circle cx="365" cy="103" r="2" />
          <circle cx="493" cy="207" r="3" /><circle cx="665" cy="123" r="2" /><circle cx="258" cy="378" r="2" />
          <circle cx="443" cy="298" r="3" /><circle cx="493" cy="475" r="2" /><circle cx="133" cy="494" r="2" />
          <circle cx="368" cy="556" r="3" /><circle cx="615" cy="390" r="2" />
        </g>
      </svg>
    </motion.div>
  )
}
