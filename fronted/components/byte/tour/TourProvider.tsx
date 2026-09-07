"use client"

import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Joyride, type Step as JoyrideStep } from "react-joyride"
import { useAuth } from "@/contexts/auth-context"
import { ChatContext } from "@/contexts/chat-context"
import { TourContext, type TourContextValue } from "@/contexts/tour-context"
import { TourTooltip } from "./TourTooltip"
import { waitForElement } from "@/lib/tour/use-wait-for-element"
import { shouldShowTour, markTourDone } from "@/lib/tour/storage"
import { STUDENT_STEPS } from "@/lib/tour/student-steps"
import { ADMIN_STEPS } from "@/lib/tour/admin-steps"
import type { AdminTab, TourRole, TourStep } from "@/lib/tour/types"
import type { ByteColor, ByteOutfit } from "@/components/byte/ByteMascot"

interface Props {
  role: TourRole
  children: ReactNode
}

function joyrideStepFor(step: TourStep): JoyrideStep {
  return {
    target: step.target ?? "body",
    placement: step.target ? (step.placement ?? "bottom") : "center",
    content: step.body,
    title: step.title,
  }
}

export function TourProvider({ role, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  // Vía useContext directo (no el hook useChat, que exige un ChatProvider
  // real) — el tour de docente comparte este mismo componente y NO tiene
  // ChatProvider como ancestro, así que esto debe poder ser undefined sin
  // romper nada.
  const chat = useContext(ChatContext)

  const steps: TourStep[] = role === "student" ? STUDENT_STEPS : ADMIN_STEPS

  const [stepIndex, setStepIndex] = useState(0)
  const [run, setRun] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [gestureUnlocked, setGestureUnlocked] = useState(false)

  const adminTabSetterRef = useRef<((tab: AdminTab) => void) | null>(null)
  // Ruta a la que NOSOTROS acabamos de navegar — distingue una navegación
  // propia del tour de una navegación real del usuario (link/atrás), que
  // debe abortar el tour con gracia en vez de quedar desincronizado.
  const expectedPathRef = useRef<string | null>(null)
  const advancingRef = useRef(false)
  // Espeja `tourActive` en un ref para que el efecto de abort-por-navegación
  // reaccione solo a cambios reales de `pathname`, no a que `tourActive` se
  // vuelva true — si dependiera de `tourActive`, el efecto se re-ejecuta en
  // el mismo tick en que activamos el tour (goToStep ya actualizó
  // expectedPathRef al destino) pero antes de que router.push aterrice, y
  // aborta el tour por una "discrepancia" que en realidad es solo el propio
  // router.push todavía en curso.
  const tourActiveRef = useRef(false)

  const registerAdminTabSetter = useCallback((fn: (tab: AdminTab) => void) => {
    adminTabSetterRef.current = fn
  }, [])

  const stop = useCallback((markDone: boolean) => {
    setRun(false)
    setTourActive(false)
    expectedPathRef.current = null
    if (markDone && user) markTourDone(role, user.id)
  }, [role, user])

  const goToStep = useCallback(async (nextIndex: number) => {
    if (advancingRef.current) return
    if (nextIndex < 0 || nextIndex >= steps.length) return
    advancingRef.current = true
    setRun(false)

    const nextStep = steps[nextIndex]

    if (role === "admin" && nextStep.adminTab) {
      adminTabSetterRef.current?.(nextStep.adminTab)
    }
    if (nextStep.openChat) {
      chat?.openChat()
    }

    const targetRoute = nextStep.route ?? window.location.pathname
    expectedPathRef.current = targetRoute
    if (targetRoute !== window.location.pathname) {
      router.push(targetRoute)
    }

    const ok = await waitForElement(nextStep.target)
    advancingRef.current = false

    if (!ok && nextStep.target) {
      // Nunca dejar al usuario atascado esperando un elemento que no aparece
      // — saltar al siguiente paso (o terminar si era el último).
      if (nextIndex + 1 < steps.length) {
        goToStep(nextIndex + 1)
      } else {
        stop(true)
      }
      return
    }

    // Scroll manual con offset para el header sticky (64px) — el
    // `scroll-margin-top` en CSS no lo respeta el scroll interno de
    // react-joyride, así que el objetivo terminaba parcialmente tapado
    // detrás del header semi-transparente con blur (se veía "doble": el
    // contenido spotlighted asomando debajo del header borroso, más el
    // mismo contenido íntegro un poco más abajo). Con scroll propio +
    // `scrollToFirstStep={false}` evitamos que Joyride vuelva a scrollear
    // encima de esto.
    if (nextStep.target) {
      const el = document.querySelector(nextStep.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        const HEADER_CLEARANCE = 140
        const targetY = window.scrollY + rect.top - HEADER_CLEARANCE
        // `html` tiene `scroll-behavior: smooth` global (app/globals.css).
        // `behavior: "instant"` debería ganarle igual, pero no todos los
        // navegadores lo respetan de forma consistente — si el scroll queda
        // animándose, Joyride calcula la posición del tooltip con el layout
        // todavía a mitad de camino, y el resultado es justo la mezcla
        // "algo asomando arriba + tooltip completo más abajo" reportada.
        // Forzamos `scroll-behavior: auto` (con !important, por encima de
        // la regla global) justo durante este scroll puntual.
        const html = document.documentElement
        const prevScrollBehavior = html.style.getPropertyValue("scroll-behavior")
        const prevPriority = html.style.getPropertyPriority("scroll-behavior")
        html.style.setProperty("scroll-behavior", "auto", "important")
        window.scrollTo({ top: Math.max(0, targetY), behavior: "instant" })
        if (prevScrollBehavior) html.style.setProperty("scroll-behavior", prevScrollBehavior, prevPriority)
        else html.style.removeProperty("scroll-behavior")
        // Pase lo que pase con el scroll (animado o no, según el
        // navegador), nunca mostramos el tooltip hasta que el navegador
        // termine de pintar el nuevo layout — así Joyride jamás calcula su
        // posición sobre un estado a medio camino. Sin esto, en algunos
        // navegadores se veía el tooltip aparecer ya posicionado mientras
        // el resto de la página todavía se movía debajo, dando la
        // impresión de dos cuadros superpuestos.
        await new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
      }
    }

    setStepIndex(nextIndex)
    setRun(true)
  }, [role, router, steps, stop, chat])

  const activateTour = useCallback((gestureGranted: boolean) => {
    setTourActive(true)
    setGestureUnlocked(gestureGranted)
    goToStep(0)
  }, [goToStep])

  // Muestra el tour automáticamente la primera vez (sin gesto previo, así
  // que el audio del primer paso no debe intentar autoplay).
  useEffect(() => {
    if (!user) return
    if (shouldShowTour(role, user.id)) {
      const t = setTimeout(() => activateTour(false), 600)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const startTour = useCallback(() => {
    // Siempre disparado por un clic en "Ver tutorial" — sí es un gesto válido.
    activateTour(true)
  }, [activateTour])

  const onNext = useCallback(() => {
    setGestureUnlocked(true)
    if (stepIndex === steps.length - 1) {
      stop(true)
    } else {
      goToStep(stepIndex + 1)
    }
  }, [stepIndex, steps.length, stop, goToStep])

  const onPrev = useCallback(() => {
    setGestureUnlocked(true)
    goToStep(stepIndex - 1)
  }, [stepIndex, goToStep])

  const onLater = useCallback(() => stop(false), [stop])
  const onNeverShowAgain = useCallback(() => stop(true), [stop])

  // Si el usuario navega por su cuenta (clic en un link real, botón "atrás"
  // del navegador) mientras el tour está activo, abortar sin marcar "visto"
  // — se retoma la próxima vez, en vez de quedar desincronizado o forzarse.
  useEffect(() => {
    tourActiveRef.current = tourActive
  }, [tourActive])

  useEffect(() => {
    if (!tourActiveRef.current) return
    if (expectedPathRef.current !== null && pathname !== expectedPathRef.current) {
      stop(false)
    }
  }, [pathname, stop])

  const currentStep = steps[stepIndex]
  // El contenido del tour usa el placeholder {{byteName}} para los pasos
  // que mencionan al compañero — se sustituye acá por el nombre real que
  // el estudiante le puso (o "Byte" si nunca lo cambió). El tour de
  // docente no tiene este placeholder — los admins no tienen `byteName`.
  const byteName = user?.progress?.byteName || "Byte"
  const displayStep: TourStep | undefined = currentStep && {
    ...currentStep,
    title: currentStep.title.replace(/\{\{byteName\}\}/g, byteName),
    body: currentStep.body.replace(/\{\{byteName\}\}/g, byteName),
  }
  const value: TourContextValue = { startTour, registerAdminTabSetter, tourActive }

  return (
    <TourContext.Provider value={value}>
      {children}
      {tourActive && displayStep && (
        <Joyride
          key={displayStep.id}
          steps={[joyrideStepFor(displayStep)]}
          stepIndex={0}
          run={run}
          continuous={false}
          scrollToFirstStep={false}
          floatingOptions={{
            shiftOptions: { padding: 12 },
            autoUpdate: { ancestorScroll: true, ancestorResize: true, elementResize: true, layoutShift: true, animationFrame: true },
          }}
          options={{
            zIndex: 200,
            primaryColor: "#4f46e5",
            skipBeacon: true,
            // Overlay más claro que el default (50% negro) — así el resto
            // de la pantalla (p.ej. el camino de módulos completo) se sigue
            // leyendo detrás del spotlight puntual, en vez de sentirse como
            // un modal estático que tapa todo.
            overlayColor: "rgba(15, 15, 25, 0.35)",
            overlayClickAction: false,
            blockTargetInteraction: true,
            disableFocusTrap: true,
            // Joyride tiene SU PROPIO scroll-al-target interno controlado
            // por `skipScroll` — independiente de `scrollToFirstStep`
            // (que solo afecta el primer paso de una corrida). Sin esto,
            // un instante después de nuestro scroll manual (con el offset
            // del header sticky), Joyride volvía a scrollear con su propio
            // cálculo — sin offset de header — desalineando todo de nuevo.
            skipScroll: true,
          }}
          tooltipComponent={() => (
            <TourTooltip
              step={displayStep}
              stepNumber={stepIndex + 1}
              totalSteps={steps.length}
              isFirst={stepIndex === 0}
              isLast={stepIndex === steps.length - 1}
              autoPlayAudio={gestureUnlocked}
              byteColor={(user?.progress?.byteColor as ByteColor) ?? "azul"}
              byteOutfit={(user?.progress?.byteOutfit as ByteOutfit) ?? "ninguno"}
              onNext={onNext}
              onPrev={onPrev}
              onLater={onLater}
              onNeverShowAgain={onNeverShowAgain}
            />
          )}
        />
      )}
    </TourContext.Provider>
  )
}
