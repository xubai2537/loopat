/**
 * GitHub device-flow login. Asks the server for a code, shows it, opens the
 * verification page, polls until the user approves — then hands the token to
 * the personal-repo picker (pick existing / create new / paste crypt key). When
 * the repo is imported, re-checks the gate to advance.
 */
import { useEffect, useRef, useState } from "react"
import { deviceStart, devicePoll, getOnboarding, type OnboardingStatus } from "../api"
import { PersonalRepoPanel } from "./dialog/PersonalRepoPanel"

export function OnboardingDevice({
  show,
  onAdvance,
}: {
  show: { title: string; description?: string }
  onAdvance: (next: OnboardingStatus) => void
}) {
  const [code, setCode] = useState<{ user_code: string; verification_uri: string; device_code: string; interval: number } | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [waiting, setWaiting] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  const start = async () => {
    setError("")
    const r = await deviceStart()
    if ("error" in r) { setError(r.error); return }
    setCode(r)
    setWaiting(true)
    window.open(r.verification_uri, "_blank", "noreferrer")
    poll(r.device_code, r.interval)
  }

  const poll = (deviceCode: string, interval: number) => {
    timer.current = window.setTimeout(async () => {
      const r = await devicePoll(deviceCode)
      if (r.status === "ok") { setWaiting(false); setToken(r.token); return }
      if (r.status === "error") { setWaiting(false); setError(r.error); return }
      const next = r.status === "slow_down" ? interval + 5 : interval
      poll(deviceCode, next)
    }, interval * 1000)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Logged in → hand off to the existing repo picker (token prefilled).
  if (token) {
    return (
      <div className="max-w-2xl mx-auto mt-12 px-6 py-8 rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="text-2xl mb-4">选择个人仓库</div>
        <PersonalRepoPanel initialToken={token} onDone={() => getOnboarding().then((s) => s && onAdvance(s))} />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 px-6 py-8 rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="text-2xl mb-2">{show.title}</div>
      {show.description && <p className="text-sm text-gray-600 leading-relaxed mb-5">{show.description}</p>}

      {!code ? (
        <button onClick={start} className="px-4 h-9 rounded text-sm bg-gray-900 text-white hover:bg-gray-700">
          用 GitHub 登录 →
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            浏览器已打开 <a href={code.verification_uri} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800">{code.verification_uri}</a>，输入下面的码并同意:
          </p>
          <div className="flex items-center gap-3">
            <code className="text-2xl font-mono tracking-widest bg-gray-50 border border-gray-200 rounded px-4 py-2">{code.user_code}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(code.user_code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          {waiting && <p className="text-xs text-gray-400">等待授权…授权后会让你选个人仓库。</p>}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
