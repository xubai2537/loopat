/**
 * LoopListPage — standalone full-width loop list for mobile.
 * Replaces LoopRedirect on mobile: shows the list instead of auto-redirecting.
 */
import { useNavigate } from "react-router-dom"
import { useWorkspace } from "../ctx"
import { getPersonalStatus } from "../api"
import { LoopListContent } from "../components/LoopListContent"
import { SetupPersonalRepoCard, isSetupPersonalRepoDismissed } from "../components/SetupPersonalRepoCard"
import { useEffect, useState } from "react"
import type { PersonalStatus } from "../api"

export function LoopListPage() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const [personal, setPersonal] = useState<PersonalStatus | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!ws.currentUser) return
    getPersonalStatus().then(setPersonal)
  }, [ws.currentUser, reloadKey])

  // Loading
  if (ws.loopsLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-sm text-gray-400">loading…</div>
      </div>
    )
  }

  // Pre-onboarding: personal repo not imported and not dismissed
  if (
    ws.currentUser &&
    personal &&
    !personal.imported &&
    !isSetupPersonalRepoDismissed()
  ) {
    return (
      <div className="h-full w-full overflow-auto">
        <SetupPersonalRepoCard
          onDismiss={() => setReloadKey((k) => k + 1)}
          hideSkip={false}
        />
      </div>
    )
  }

  // Empty state
  if (ws.loops.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-gray-500 gap-3">
        <div className="text-sm">no loops yet</div>
        {ws.currentUser ? (
          <button
            onClick={() => ws.setNewLoopDialogOpen(true)}
            className="px-3 h-8 rounded text-sm bg-gray-900 text-white hover:bg-gray-700"
          >
            + New Loop
          </button>
        ) : (
          <div className="text-xs text-gray-400">log in to create one</div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white overflow-auto">
      <LoopListContent onSelect={(id) => navigate(`/loop/${id}`)} />
    </div>
  )
}
