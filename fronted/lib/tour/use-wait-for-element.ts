// Espera (con poll simple) a que un selector exista en el DOM antes de
// resolver — usado tras una navegación de página o cambio de pestaña para
// saber cuándo el siguiente paso del tour ya puede mostrarse. No hace falta
// MutationObserver: las páginas del dashboard ya muestran su propio spinner
// mientras cargan datos, así que un poll con timeout generoso es suficiente.
export function waitForElement(
  selector: string | undefined,
  { timeoutMs = 8000, pollMs = 150 }: { timeoutMs?: number; pollMs?: number } = {}
): Promise<boolean> {
  if (!selector) return Promise.resolve(true)
  if (document.querySelector(selector)) return Promise.resolve(true)

  return new Promise(resolve => {
    const start = Date.now()
    const interval = setInterval(() => {
      if (document.querySelector(selector)) {
        clearInterval(interval)
        resolve(true)
        return
      }
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval)
        resolve(false)
      }
    }, pollMs)
  })
}
