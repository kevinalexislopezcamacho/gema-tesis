import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'

// Two independent, free, no-API-key code execution services. Wandbox is tried
// first (broader language/version pinning to match what the course expects);
// if its own sandbox infra is having a bad day, Judge0's public instance is
// tried as a fully independent fallback before giving up — the two run on
// unrelated infrastructure, so the odds of both failing at once are low.
const WANDBOX_URL = 'https://wandbox.org/api/compile.json'
// base64_encoded=true: student code can contain non-ASCII (tildes, ñ, emoji,
// etc.) which Judge0 otherwise rejects with "cannot be converted to UTF-8".
const JUDGE0_URL  = 'https://ce.judge0.com/submissions?base64_encoded=true&wait=true'

// Pinned stable versions, not "-head" (nightly/bleeding-edge builds) — those broke outright
// (catatonit failures) and, for java/javascript/typescript, "-head" doesn't even exist as a
// compiler name on Wandbox, so those three languages never actually worked before this fix.
const WANDBOX_COMPILERS: Record<string, string> = {
  python:     'cpython-3.13.8',
  cpp:        'gcc-13.2.0',
  java:       'openjdk-jdk-21+35',
  javascript: 'nodejs-20.17.0',
  typescript: 'typescript-5.6.2',
}

// Judge0 language ids (from GET /languages on ce.judge0.com), picked to match
// the Wandbox versions above as closely as available.
const JUDGE0_LANGUAGES: Record<string, number> = {
  python:     109, // Python 3.13.2
  cpp:        105, // C++ (GCC 14.1.0)
  java:       91,  // Java (JDK 17.0.6)
  javascript: 102, // JavaScript (Node.js 22.08.0)
  typescript: 101, // TypeScript 5.6.2
}

interface RunResult {
  stdout:     string
  stderr:     string
  compileErr: string
}

interface WandboxResponse {
  status:          string
  program_output:  string
  program_error:   string
  compiler_output: string
  compiler_error:  string
  compiler_message?: string
  program_message?:  string
}

class ContainerStartError extends Error {}

// Wandbox's own sandbox infra occasionally fails to spin up a container for a
// run — that shows up as a low-level container-runtime error with no real
// program output, and can land in *any* of the four output fields depending
// on which stage of the pipeline it failed at (compile step vs run step).
// Known signatures seen in the wild: catatonit init failures, "failed to
// exec", and OCI/crun errors (e.g. "clone: Resource temporarily unavailable"
// when Wandbox's own host is out of PIDs) — none of these are the student's
// fault, so they get retried / failed over instead of shown as-is.
const INFRA_ERR_RE = /catatonit|failed to exec|OCI runtime error|crun:/i

function isContainerErr(data: WandboxResponse): boolean {
  if (data.program_output?.trim()) return false // it actually ran something — trust that
  return [data.program_error, data.compiler_error, data.compiler_message, data.program_message]
    .some(field => field && INFRA_ERR_RE.test(field))
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// Retry Wandbox a few times with short backoff — fast retries catch the
// common transient blip; anything past that is handed off to Judge0 rather
// than making the student wait through a long retry loop on a single provider.
async function callWandbox(compiler: string, code: string, maxRetries = 2): Promise<RunResult> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(WANDBOX_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler, code }),
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}: ${await res.text()}`)
        if (attempt < maxRetries) await sleep(500 * (attempt + 1))
        continue
      }
      const data = await res.json() as WandboxResponse
      if (isContainerErr(data)) {
        lastErr = new ContainerStartError('Wandbox infra failure')
        if (attempt < maxRetries) await sleep(700 * (attempt + 1))
        continue
      }
      return {
        stdout:     data.program_output?.trim()  ?? '',
        stderr:     data.program_error?.trim()   ?? '',
        compileErr: data.compiler_error?.trim()  ?? '',
      }
    } catch (e) {
      lastErr = e
      if (attempt < maxRetries) await sleep(500 * (attempt + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

// Judge0 status ids: 6 = Compilation Error, everything else in the "finished"
// range (3, 5, 7-14) either succeeded or is a runtime-side failure.
async function callJudge0(languageId: number, code: string, maxRetries = 2): Promise<RunResult> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(JUDGE0_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: Buffer.from(code, 'utf-8').toString('base64'),
          language_id: languageId,
        }),
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}: ${await res.text()}`)
        if (attempt < maxRetries) await sleep(500 * (attempt + 1))
        continue
      }
      const data = await res.json()
      if (data.status?.id === 13 || data.status?.id === 14) {
        // Internal Error / Exec Format Error — Judge0's own infra, not the student's code.
        lastErr = new ContainerStartError('Judge0 infra failure')
        if (attempt < maxRetries) await sleep(700 * (attempt + 1))
        continue
      }
      const decode = (b64: string | null) => b64 ? Buffer.from(b64, 'base64').toString('utf-8').trim() : ''
      return {
        stdout:     decode(data.stdout),
        stderr:     decode(data.stderr),
        compileErr: decode(data.compile_output),
      }
    } catch (e) {
      lastErr = e
      if (attempt < maxRetries) await sleep(500 * (attempt + 1))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

// Shared by the HTTP handler below and by videoController's question-generation
// pipeline, which uses it to sanity-check that generated "codigo_inicial"
// snippets are actually incomplete before storing them.
export async function runCode(lenguaje: string, code: string): Promise<RunResult> {
  const compiler   = WANDBOX_COMPILERS[lenguaje] ?? WANDBOX_COMPILERS['python']
  const languageId = JUDGE0_LANGUAGES[lenguaje]  ?? JUDGE0_LANGUAGES['python']

  // Each provider expects the public class named differently for Java.
  const forJava = (className: string) =>
    lenguaje === 'java' ? code.replace(/public\s+class\s+\w+/, `public class ${className}`) : code

  try {
    return await callWandbox(compiler, forJava('prog'))
  } catch (wandboxErr) {
    // Wandbox is down or exhausted its retries — fail over to Judge0 (fully
    // independent infra) before giving up.
    try {
      return await callJudge0(languageId, forJava('Main'))
    } catch (judge0Err) {
      console.error('runCode: both providers failed', { wandboxErr, judge0Err })
      throw new Error('both code execution providers failed')
    }
  }
}

// POST /api/execute
export const executeCode = async (req: AuthRequest & Request, res: Response) => {
  const { code, lenguaje = 'python' } = req.body

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Falta el campo "code"' })
  }

  try {
    const data = await runCode(lenguaje, code)
    return res.status(200).json({ success: true, data })
  } catch {
    // Never show internal HTTP/JSON debug text to the student — just a clean, actionable message.
    return res.status(503).json({
      success: false,
      error: 'El ejecutor de código no está disponible en este momento. Intenta de nuevo en unos segundos.',
    })
  }
}
