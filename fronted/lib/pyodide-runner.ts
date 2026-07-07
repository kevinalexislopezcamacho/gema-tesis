// Ejecuta Python real en el navegador vía Pyodide (WebAssembly) — sin riesgo
// de seguridad en el servidor, ya que el código nunca se ejecuta ahí.

declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL: string }) => Promise<any>
  }
}

const PYODIDE_VERSION = "0.26.2"
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`

let pyodidePromise: Promise<any> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) { resolve(); return }
    const script = document.createElement("script")
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("No se pudo cargar Pyodide"))
    document.head.appendChild(script)
  })
}

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${PYODIDE_CDN}pyodide.js`)
      if (!window.loadPyodide) throw new Error("Pyodide no se cargó correctamente")
      return window.loadPyodide({ indexURL: PYODIDE_CDN })
    })()
  }
  return pyodidePromise
}

export interface PyRunResult {
  stdout: string
  error: string | null
}

export async function runPythonCapture(code: string): Promise<PyRunResult> {
  try {
    const pyodide = await getPyodide()
    let stdout = ""
    pyodide.setStdout({ batched: (s: string) => { stdout += s + "\n" } })
    pyodide.setStderr({ batched: () => {} })

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("El código tardó demasiado (¿bucle infinito?)")), 5000)
    )

    await Promise.race([pyodide.runPythonAsync(code), timeout])
    return { stdout: stdout.trimEnd(), error: null }
  } catch (err: any) {
    return { stdout: "", error: err?.message ?? "Error al ejecutar el código" }
  }
}
