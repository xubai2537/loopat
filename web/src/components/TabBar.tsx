/**
 * TabBar — fixed bottom navigation bar for mobile.
 * Only renders when useIsMobile() is true.
 */
import { useNavigate, useLocation } from "react-router-dom"
import { MessageCircle, SlidersHorizontal, User } from "lucide-react"
import { useIsMobile } from "../lib/useIsMobile"

const TABS = [
  { id: "loop", label: "Loop", icon: "⑂", path: "/loop" },
  { id: "chat", label: "Chat", icon: null, path: "/chat" },
  { id: "context", label: "Context", icon: "⌘", path: "/context" },
  { id: "me", label: "Me", icon: null, path: "/me" },
] as const

/** Returns true if the current path matches the given tab. */
function isTabActive(pathname: string, tabPath: string, tabId: string): boolean {
  if (pathname === "/" && tabId === "loop") return true
  if (tabId === "loop" && pathname.startsWith("/loop")) return true
  if (tabId === "chat" && pathname.startsWith("/chat")) return true
  if (tabId === "context" && pathname.startsWith("/context")) return true
  if (tabId === "me" && pathname === "/me") return true
  return false
}

function TabIcon({ tabId }: { tabId: string }) {
  switch (tabId) {
    case "loop":
      return <span className="text-lg leading-none">⑂</span>
    case "chat":
      return <MessageCircle size={18} />
    case "context":
      return <span className="text-lg leading-none">⌘</span>
    case "me":
      return <User size={18} />
    default:
      return null
  }
}

export function TabBar() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  if (!isMobile) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-14 bg-white border-t border-gray-200 flex items-center justify-around"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.path, tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.path)}
            className={
              "flex flex-col items-center justify-center gap-0.5 h-full flex-1 transition-colors " +
              (active
                ? "text-gray-900"
                : "text-gray-400 hover:text-gray-600")
            }
          >
            <TabIcon tabId={tab.id} />
            <span className="text-[10px] leading-none font-medium">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
