/**
 * Shared loop list content — search, scope filters, and loop items.
 * Used by the sidebar in LoopPage and the full-page LoopListPage for mobile.
 */
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, ArchiveRestore } from "lucide-react"
import { useWorkspace } from "../ctx"
import { useLoopStatus } from "../useLoopStatus"
import { useIsMobile } from "../lib/useIsMobile"
import { markLoopViewed } from "../api"

export interface LoopListContentProps {
  /** Current selected loop id (undefined when used standalone on mobile) */
  currentId?: string
  /** Callback when a loop is selected — navigate to /loop/:id or set collapsed */
  onSelect?: (loopId: string) => void
}

export function LoopListContent({ currentId, onSelect }: LoopListContentProps) {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const [scope, setScope] = useState<"mine" | "all" | "rfd">("mine")
  const [search, setSearch] = useState("")
  const isMobile = useIsMobile()
  const loopIds = useMemo(() => ws.loops.map((l) => l.id), [ws.loops])
  const statusMap = useLoopStatus(loopIds)

  const userId = ws.currentUser?.id
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return ws.loops.filter((loop) => {
      const effective = loop.driver ?? loop.createdBy
      if (scope === "mine" && loop.createdBy !== userId && effective !== userId) return false
      if (scope === "rfd" && !loop.rfdRequestedAt) return false
      if (q && !loop.title.toLowerCase().includes(q) && !loop.id.toLowerCase().includes(q)) return false
      return true
    })
  }, [ws.loops, scope, userId, search])

  const handleSelect = (loopId: string) => {
    markLoopViewed(loopId)
    if (onSelect) {
      onSelect(loopId)
    } else {
      navigate(`/loop/${loopId}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-3 pt-3 pb-2 space-y-2">
        <div className="flex items-center gap-1">
          {(["mine", "all", "rfd"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={
                scope === s
                  ? s === "rfd"
                    ? "px-2 h-6 rounded text-[11px] flex items-center gap-1 bg-amber-600 text-white"
                    : "px-2 h-6 rounded text-[11px] bg-gray-900 text-white"
                  : s === "rfd"
                    ? "px-2 h-6 rounded text-[11px] flex items-center gap-1 text-amber-700 hover:bg-amber-50"
                    : "px-2 h-6 rounded text-[11px] text-gray-500 hover:bg-gray-100"
              }
            >
              {s === "mine" ? "mine" : s === "all" ? "all" : "RFD"}
            </button>
          ))}
          <span className="text-[11px] text-gray-400 ml-auto pr-1">{filtered.length}</span>
          <button
            type="button"
            onClick={() => ws.setShowArchived(!ws.showArchived)}
            className={
              ws.showArchived
                ? "w-6 h-6 flex items-center justify-center text-gray-700 bg-gray-100 rounded"
                : "w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
            }
            title={ws.showArchived ? "hide archived" : "show archived"}
          >
            <Archive size={13} />
          </button>
        </div>
        <input
          type="text"
          name="loop-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search loops…"
          className="w-full h-7 rounded px-2 text-[12px] bg-gray-100 border border-transparent focus:border-gray-300 focus:bg-white focus:outline-none text-gray-600 placeholder-gray-400"
        />
      </div>

      {/* Loop items */}
      <div className="flex-1 min-h-0 overflow-auto py-1">
        {filtered.map((loop) => {
          const sel = currentId === loop.id
          const archived = loop.archived === true
          const isOwner = ws.currentUser?.id === loop.createdBy
          const entry = statusMap[loop.id]
          const isDone = entry?.status === "Done" || entry?.status === "Ready"
          const isRunning = entry !== undefined && !isDone
          return (
            <div
              key={loop.id}
              className={
                "group/row relative flex items-stretch " +
                (sel ? "bg-gray-100" : "hover:bg-gray-50")
              }
            >
              <button
                type="button"
                onClick={() => handleSelect(loop.id)}
                className={
                  "flex-1 min-w-0 px-3 py-1.5 flex items-center gap-2 text-left " +
                  (archived ? "opacity-60" : "")
                }
              >
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 " +
                    (archived
                      ? "bg-gray-400"
                      : isRunning
                        ? "bg-blue-500 animate-pulse"
                        : isDone && !entry?.viewed
                          ? "bg-yellow-500"
                          : isDone
                            ? "bg-emerald-500"
                            : "bg-gray-300")
                  }
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-900 truncate flex items-center gap-1.5">
                    {archived && <Archive size={10} className="text-gray-400 shrink-0" />}
                    {loop.rfdRequestedAt && (
                      <span className="shrink-0 text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-medium tracking-wide">
                        RFD
                      </span>
                    )}
                    <span className="truncate">{loop.title}</span>
                    {entry && (
                      <span
                        className={
                          "shrink-0 text-[10px] font-medium " +
                          (isRunning
                            ? "text-blue-500"
                            : isDone
                              ? "text-emerald-500"
                              : "text-gray-400")
                        }
                      >
                        {entry.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                    <span>{loop.driver ?? loop.createdBy}</span>
                    <span className="text-gray-300">·</span>
                    <span className="font-mono text-[10px] text-gray-400">
                      {loop.id.slice(0, 6)}
                    </span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                disabled={!isOwner}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isOwner) ws.setLoopArchived(loop.id, !archived)
                }}
                className={
                  (isMobile
                    ? "opacity-100"
                    : "opacity-0 group-hover/row:opacity-100") +
                  " transition-opacity w-7 flex items-center justify-center " +
                  (isOwner
                    ? "text-gray-400 hover:text-gray-700"
                    : "text-gray-300 cursor-not-allowed")
                }
                title={
                  isOwner
                    ? archived
                      ? "unarchive"
                      : "archive (hide + read-only)"
                    : `only ${loop.createdBy} can ${archived ? "unarchive" : "archive"} this loop`
                }
              >
                {archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-[12px] text-gray-400 italic">
            no loops · click "+ New Loop"
          </div>
        )}
      </div>
    </div>
  )
}
