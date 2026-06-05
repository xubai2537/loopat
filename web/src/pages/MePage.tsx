/**
 * MePage — user profile/dashboard tab for the mobile bottom TabBar.
 * Shows user info, personal repo status, quick links, and logout.
 */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { User, Settings, Kanban, BarChart3, Key, Moon, Sun, Info, Shield, LogOut, Server } from "lucide-react"
import { useWorkspace } from "../ctx"
import { getPersonalStatus, type PersonalStatus } from "../api"
import { useTheme } from "../theme"

export function MePage() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()
  const [personal, setPersonal] = useState<PersonalStatus | null>(null)

  const user = ws.currentUser
  const isAdmin = user?.role === "admin"

  useEffect(() => {
    if (user) getPersonalStatus().then(setPersonal)
  }, [user])

  const handleLogout = () => {
    ws.logout()
    navigate("/loop")
  }

  if (!user) {
    return (
      <div className="h-full w-full flex items-center justify-center text-sm text-gray-400">
        not logged in
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-white overflow-auto">
      {/* User profile header */}
      <div className="px-5 pt-8 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-900 text-white text-xl flex items-center justify-center font-medium">
            {(user.id[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-base font-medium text-gray-900 truncate">{user.id}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                {user.role}
              </span>
              <span className="text-xs text-gray-400">{user.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal repo status */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-2">
          Personal Repo
        </div>
        {personal ? (
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                personal.imported ? "bg-emerald-500" : "bg-yellow-500"
              }`}
            />
            <span className="text-sm text-gray-700">
              {personal.imported ? "connected" : "not configured"}
            </span>
            <button
              onClick={() => navigate("/settings/personal-repo")}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800"
            >
              configure →
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-400">loading…</div>
        )}
      </div>

      {/* Quick links */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1">
          Quick Links
        </div>
        <div className="flex flex-col">
          <MeRow icon={<Settings size={16} />} label="Settings" onClick={() => navigate("/settings")} />
          <MeRow icon={<Kanban size={16} />} label="Focus / Kanban" onClick={() => navigate("/kanban")} />
          <MeRow icon={<BarChart3 size={16} />} label="Token Usage" onClick={() => navigate("/settings/token-usage")} />
          <MeRow icon={<Key size={16} />} label="API Tokens" onClick={() => navigate("/settings/api-tokens")} />
          <MeRow
            icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            label={`Theme: ${theme === "dark" ? "Dark" : "Light"}`}
            onClick={toggleTheme}
          />
          <MeRow icon={<Info size={16} />} label="About" onClick={() => window.dispatchEvent(new CustomEvent("loopat:open-about"))} />
        </div>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1">
            Admin
          </div>
          <div className="flex flex-col">
            <MeRow icon={<Server size={16} />} label="Platform" onClick={() => navigate("/admin/system")} />
            <MeRow icon={<Shield size={16} />} label="Users" onClick={() => navigate("/settings/admin-users")} />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-5 py-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-2 py-2 rounded text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}

/** A single row in the Me page quick links list. */
function MeRow(props: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex items-center gap-3 px-2 py-2.5 rounded text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
    >
      <span className="text-gray-400 w-5 flex items-center justify-center">{props.icon}</span>
      <span>{props.label}</span>
    </button>
  )
}
