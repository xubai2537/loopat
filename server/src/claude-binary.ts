import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, mkdtempSync, cpSync, rmSync } from "node:fs"
import { execSync, execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { dirname, resolve, join } from "node:path"
import { tmpdir } from "node:os"
import { createRequire } from "node:module"

const execFileP = promisify(execFile)

/** Recursively find a file named `claude` under `dir`. */
function findClaudeBinary(dir: string): string | null {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        const found = findClaudeBinary(full)
        if (found) return found
      } else if (entry === "claude" && st.isFile()) {
        return full
      }
    }
  } catch { /* permissions, etc. */ }
  return null
}

/** Which js package manager is available: prefer bun, fall back to npm. */
async function detectAvailablePkgManager(): Promise<"bun" | "npm"> {
  try { await execFileP("bun", ["--version"]); return "bun" } catch { /* bun not found */ }
  return "npm" // let execFile's ENOENT surface naturally if npm is also missing
}

function detectIsMusl(): boolean {
  if (process.platform !== "linux") return false
  try {
    const lddOut = execSync("ldd --version 2>&1", { encoding: "utf8" }) as string
    return /musl/i.test(lddOut)
  } catch {}
  return false
}

function findWorkspaceRoot(start: string): string[] {
  const roots: string[] = []
  let cur = start
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(cur, "node_modules"))) roots.push(cur)
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  if (roots.length === 0) throw new Error("could not locate node_modules from " + start)
  return roots
}

export function resolveClaudeBinary(): string {
  const platform = process.platform
  const arch = process.arch
  const ext = platform === "win32" ? ".exe" : ""

  const pkgs: string[] = []
  if (platform === "linux") {
    if (detectIsMusl()) {
      pkgs.push(`claude-agent-sdk-linux-${arch}-musl`, `claude-agent-sdk-linux-${arch}`)
    } else {
      pkgs.push(`claude-agent-sdk-linux-${arch}`, `claude-agent-sdk-linux-${arch}-musl`)
    }
  } else {
    pkgs.push(`claude-agent-sdk-${platform}-${arch}`)
  }

  const here = fileURLToPath(import.meta.url)
  const roots = findWorkspaceRoot(dirname(here))
  const candidates: string[] = []
  for (const root of roots) {
    for (const pkg of pkgs) {
      candidates.push(join(root, "node_modules", "@anthropic-ai", pkg, `claude${ext}`))
      const bunDir = join(root, "node_modules", ".bun")
      if (existsSync(bunDir)) {
        try {
          const entries = execSync(`ls "${bunDir}"`, { encoding: "utf8" }).split("\n").filter(Boolean)
          for (const entry of entries) {
            if (entry.startsWith(`@anthropic-ai+${pkg}@`)) {
              candidates.push(join(bunDir, entry, "node_modules", "@anthropic-ai", pkg, `claude${ext}`))
            }
          }
        } catch {}
      }
    }
  }

  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  throw new Error(`claude binary not found; tried:\n${candidates.join("\n")}`)
}

/** Where the fetched linux claude lives on a non-linux host. */
function sandboxClaudeDir(): string {
  const installDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
  return join(installDir, "sandbox-claude")
}
function sandboxClaudeBinaryPath(): string {
  return join(sandboxClaudeDir(), "node_modules", "@anthropic-ai", `claude-agent-sdk-linux-${process.arch}`, "claude")
}

/**
 * The claude binary the SANDBOX runs (the AI executes inside a linux podman
 * container). On a linux host that's just the host claude. On a non-linux host
 * npm only installed the host (e.g. darwin) binary, so we fetch the linux-<arch>
 * one into <loopat>/sandbox-claude — bind THAT into the sandbox, not the host
 * binary (otherwise: "Exec format error").
 */
export function resolveSandboxClaudeBinary(): string {
  if (process.platform === "linux") return resolveClaudeBinary()
  const candidate = sandboxClaudeBinaryPath()
  if (existsSync(candidate)) return candidate
  // The binary may have been installed to a non-standard path (e.g. bun
  // nesting). Search the sandbox-claude tree before giving up.
  const found = findClaudeBinary(sandboxClaudeDir())
  if (found) return found
  throw new Error(`sandbox (linux) claude not found at ${candidate}; run ensureSandboxClaudeBinary() (loopat fetches it on first boot)`)
}

/**
 * Fetch the linux claude binary by downloading the npm package tarball directly
 * and extracting the `claude` binary. This works without any package manager
 * (npm/bun) and bypasses platform-OS checks that block cross-platform installs.
 */
async function fetchViaDirectDownload(
  arch: string, version: string, dest: string, onLog?: (m: string) => void
): Promise<boolean> {
  const pkg = `@anthropic-ai/claude-agent-sdk-linux-${arch}`
  const registryUrl = `https://registry.npmjs.org/${pkg}/${version}`
  let tmp: string | undefined
  try {
    onLog?.(`direct download from npm registry…`)
    const metaResp = await fetch(registryUrl)
    if (!metaResp.ok) throw new Error(`registry returned ${metaResp.status}`)
    const meta = await metaResp.json() as any
    const tarballUrl: string = meta.dist?.tarball
    if (!tarballUrl) throw new Error(`no tarball in registry response`)
    onLog?.(`downloading ${tarballUrl}…`)
    const tarballResp = await fetch(tarballUrl)
    if (!tarballResp.ok) throw new Error(`tarball download returned ${tarballResp.status}`)
    const buf = Buffer.from(await tarballResp.arrayBuffer())
    tmp = mkdtempSync(join(tmpdir(), "loopat-claude-"))
    const tgzPath = join(tmp, "pkg.tgz")
    writeFileSync(tgzPath, buf)
    await execFileP("tar", ["xzf", tgzPath, "--strip-components=1", "-C", tmp], { timeout: 30_000 })
    // The tarball extracts as package/claude (with --strip-components=1 it's just claude)
    const extracted = join(tmp, "claude")
    if (!existsSync(extracted)) {
      // Some tarballs nest differently, try without --strip-components
      await execFileP("tar", ["xzf", tgzPath, "-C", tmp], { timeout: 30_000 })
      const found = findClaudeBinary(tmp)
      if (!found) throw new Error(`claude binary not found in tarball`)
      const targetDir = dirname(sandboxClaudeBinaryPath())
      mkdirSync(targetDir, { recursive: true })
      cpSync(found, sandboxClaudeBinaryPath())
    } else {
      const targetDir = dirname(sandboxClaudeBinaryPath())
      mkdirSync(targetDir, { recursive: true })
      cpSync(extracted, sandboxClaudeBinaryPath())
    }
    // Make it executable
    try { await execFileP("chmod", ["+x", sandboxClaudeBinaryPath()]) } catch {}
    return true
  } catch (e: any) {
    onLog?.(`direct download failed: ${e?.message ?? e}`)
    return false
  } finally {
    if (tmp) try { rmSync(tmp, { recursive: true }) } catch {}
  }
}

/**
 * Make sure the sandbox's linux claude exists, fetching it if not. No-op on a
 * linux host (host claude IS the sandbox claude). On a non-linux host: tries
 * npm --force (cross-platform), then direct tarball download (no pm needed),
 * then bun add (last resort). Pinned to the SDK version. Best-effort and
 * idempotent: once fetched, returns immediately.
 */
export async function ensureSandboxClaudeBinary(onLog?: (m: string) => void): Promise<void> {
  if (process.platform === "linux") return
  if (existsSync(sandboxClaudeBinaryPath())) return
  const arch = process.arch
  let version = ""
  try { version = createRequire(import.meta.url)("@anthropic-ai/claude-agent-sdk/package.json").version } catch {}
  const spec = `@anthropic-ai/claude-agent-sdk-linux-${arch}${version ? `@${version}` : ""}`
  const dest = sandboxClaudeDir()
  mkdirSync(dest, { recursive: true })
  onLog?.(`host is ${process.platform}/${arch}; fetching linux claude for the sandbox (${spec})…`)

  // Strategy: npm --force (cross-platform if available), then direct tarball
  // download (no package manager needed), then bun add (last resort).
  // bun add respects the os field and silently skips platform-mismatched
  // binaries, so it's a distant third.
  const pm = await detectAvailablePkgManager()

  // 1. Try npm install --force (reliable cross-platform, if npm is on PATH).
  if (pm === "npm") {
    onLog?.(`using npm`)
    try {
      await execFileP("npm", ["install", "--prefix", dest, "--no-save", "--force", spec], { timeout: 180_000 })
    } catch (e: any) {
      onLog?.(`npm failed: ${e?.message ?? e}`)
    }
  } else {
    // bun is available but npm might also be; try npm first anyway.
    onLog?.(`trying npm install --force…`)
    try {
      await execFileP("npm", ["install", "--prefix", dest, "--no-save", "--force", spec], { timeout: 180_000 })
    } catch (e: any) {
      onLog?.(`npm unavailable/failed: ${e?.message ?? e}`)
    }
  }
  if (existsSync(sandboxClaudeBinaryPath())) { onLog?.(`sandbox claude ready`); return }
  const found1 = findClaudeBinary(dest)
  if (found1) { onLog?.(`found sandbox claude at ${found1}`); return }

  // 2. Direct tarball download (no package manager needed).
  if (version && await fetchViaDirectDownload(arch, version, dest, onLog)) {
    if (existsSync(sandboxClaudeBinaryPath())) { onLog?.(`sandbox claude ready`); return }
  }

  // 3. bun add as last resort.
  onLog?.(`trying bun add…`)
  writeFileSync(join(dest, "package.json"), '{"private":true}')
  try {
    await execFileP("bun", ["add", spec], { cwd: dest, timeout: 180_000 })
  } catch (e: any) {
    onLog?.(`bun add failed: ${e?.message ?? e}`)
  }

  // Check the expected path first, then search the tree (bun may nest differently).
  if (existsSync(sandboxClaudeBinaryPath())) {
    onLog?.(`sandbox claude ready`)
    return
  }
  const found = findClaudeBinary(dest)
  if (found) {
    onLog?.(`found sandbox claude at ${found}`)
    return
  }
  throw new Error(`fetch finished but ${sandboxClaudeBinaryPath()} missing`)
}
