// Code execution is proxied through our own backend to avoid CORS issues.
// Backend calls: POST /api/execute → Wandbox (https://wandbox.org), with retries for
// its occasional container-startup failures.

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

export async function runCode(
  code: string,
  lenguaje: string = 'python',
  token?: string | null
): Promise<{ stdout: string; stderr: string; error?: string }> {
  try {
    const res = await fetch(`${API}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ code, lenguaje }),
    })

    const d = await res.json()

    if (!d.success) {
      return { stdout: '', stderr: '', error: d.error || 'Error desconocido' }
    }

    const { stdout, stderr, compileErr } = d.data
    // Only treat compileErr as fatal when there is no program output.
    // GCC/Clang emit warnings in compiler_error even on successful runs.
    if (compileErr && !stdout) return { stdout: '', stderr: compileErr, error: compileErr }
    return { stdout, stderr }
  } catch {
    return { stdout: '', stderr: '', error: 'No se pudo conectar al servidor. Verifica que el backend esté corriendo.' }
  }
}

export const LANG_LABELS: Record<string, { name: string; monacoId: string; color: string }> = {
  python:     { name: 'Python',     monacoId: 'python',     color: 'text-blue-400 bg-blue-500/15 border-blue-500/30'       },
  cpp:        { name: 'C++',        monacoId: 'cpp',        color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30'       },
  java:       { name: 'Java',       monacoId: 'java',       color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
  javascript: { name: 'JavaScript', monacoId: 'javascript', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  typescript: { name: 'TypeScript', monacoId: 'typescript', color: 'text-blue-500 bg-blue-600/15 border-blue-600/30'      },
}

// Infer language from code content when lenguaje field is missing or unknown
export function detectarLenguaje(codigo: string, lenguajePregunta?: string | null): string {
  if (lenguajePregunta && LANG_LABELS[lenguajePregunta]) return lenguajePregunta
  const c = codigo
  if (c.includes('#include') || c.includes('cout') || c.includes('std::')) return 'cpp'
  if (c.includes('public class') || c.includes('System.out') || c.includes('void main')) return 'java'
  if (c.includes('console.log') || (c.includes('const ') && !c.includes('def '))) return 'javascript'
  return 'python'
}
