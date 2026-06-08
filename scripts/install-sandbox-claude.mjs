#!/usr/bin/env node
/**
 * postinstall: make sure a LINUX claude binary is available for the sandbox.
 *
 * loopat runs the AI inside a linux podman sandbox, so it needs the
 * linux-<arch> claude binary. npm only installs the claude-agent-sdk platform
 * binary matching the HOST (os/cpu filtered optionalDependencies) — so on a
 * linux host we already have it (no-op here), but on macOS/Windows npm installs
 * the darwin/win binary and the sandbox would hit "Exec format error".
 *
 * On a non-linux host we fetch the linux-<arch> binary into
 * <loopat>/sandbox-claude (pinned to the SDK version we depend on).
 * Best-effort: a failure only means sandbox AI won't run on this host until
 * fixed; the install itself still succeeds.
 */
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

if (process.platform === "linux") process.exit(0) // host claude IS the sandbox claude

const arch = process.arch // "arm64" | "x64"
const pkg = `@anthropic-ai/claude-agent-sdk-linux-${arch}`
const installDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dest = join(installDir, "sandbox-claude")
const expected = join(dest, "node_modules", pkg, "claude")

if (existsSync(expected)) process.exit(0) // already fetched

/** Recursively find a file named `claude` under `dir`. */
function findClaude(dir) {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        const found = findClaude(full)
        if (found) return found
      } else if (entry === "claude" && st.isFile()) {
        return full
      }
    }
  } catch { /* permissions */ }
  return null
}

function checkAndReport() {
  if (existsSync(expected)) {
    console.log(`[loopat] sandbox claude ready at ${expected}`)
    return true
  }
  const found = findClaude(dest)
  if (found) {
    console.log(`[loopat] sandbox claude ready at ${found}`)
    return true
  }
  return false
}

try {
  const require = createRequire(import.meta.url)
  let version = ""
  try {
    version = require("@anthropic-ai/claude-agent-sdk/package.json").version
  } catch {}
  const spec = version ? `${pkg}@${version}` : pkg
  mkdirSync(dest, { recursive: true })
  console.log(`[loopat] host is ${process.platform}/${arch}; fetching linux claude for the sandbox (${spec})…`)

  // npm with --force reliably installs linux packages on non-linux hosts.
  // bun add respects the os field and silently skips platform-mismatched
  // binaries, so try npm first, then fall back to bun.
  console.log(`[loopat] trying npm install --force…`)
  try {
    execFileSync("npm", ["install", "--prefix", dest, "--no-save", "--force", spec], { stdio: "inherit" })
    if (checkAndReport()) process.exit(0)
  } catch (e) {
    console.warn(`[loopat] npm failed: ${e?.message ?? e}`)
  }

  // npm didn't produce the binary; try bun as fallback.
  writeFileSync(join(dest, "package.json"), '{"private":true}')
  console.log(`[loopat] trying bun add…`)
  try {
    execFileSync("bun", ["add", spec], { cwd: dest, stdio: "inherit" })
    if (checkAndReport()) process.exit(0)
  } catch (e) {
    console.warn(`[loopat] bun add failed: ${e?.message ?? e}`)
  }

  if (!checkAndReport()) {
    // 3. Direct tarball download from npm registry (no package manager needed).
    if (version) {
      console.log(`[loopat] trying direct download from npm registry…`)
      let tmp
      try {
        const registryUrl = `https://registry.npmjs.org/${pkg}/${version}`
        const metaResp = await fetch(registryUrl)
        if (!metaResp.ok) throw new Error(`registry returned ${metaResp.status}`)
        const meta = await metaResp.json()
        const tarballUrl = meta.dist?.tarball
        if (!tarballUrl) throw new Error(`no tarball in registry response`)
        console.log(`[loopat] downloading ${tarballUrl}…`)
        const tarballResp = await fetch(tarballUrl)
        if (!tarballResp.ok) throw new Error(`tarball download returned ${tarballResp.status}`)
        const buf = Buffer.from(await tarballResp.arrayBuffer())
        tmp = mkdtempSync(join(tmpdir(), "loopat-claude-"))
        const tgzPath = join(tmp, "pkg.tgz")
        writeFileSync(tgzPath, buf)
        execFileSync("tar", ["xzf", tgzPath, "--strip-components=1", "-C", tmp])
        const extracted = join(tmp, "claude")
        if (existsSync(extracted)) {
          mkdirSync(dirname(expected), { recursive: true })
          cpSync(extracted, expected)
          execFileSync("chmod", ["+x", expected])
        }
      } catch (e2) {
        console.warn(`[loopat] direct download failed: ${e2?.message ?? e2}`)
      } finally {
        if (tmp) try { rmSync(tmp, { recursive: true }) } catch {}
      }
    }
    checkAndReport()
    if (!existsSync(expected)) {
      console.warn(`[loopat] sandbox claude install finished but ${expected} is missing`)
    }
  }
} catch (e) {
  console.warn(`[loopat] could not fetch linux claude for the sandbox: ${e?.message ?? e}`)
  console.warn(`[loopat] sandbox AI won't run on this host until fixed; everything else works.`)
}
