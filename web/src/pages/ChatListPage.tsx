/**
 * ChatListPage — standalone full-width conversation list for mobile.
 * Replaces ChatPage's auto-redirect on mobile: shows the list instead.
 */
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  listChatConversations,
  openChatDm,
  createChatChannel,
  deleteChatChannel,
  type ChatConversation,
} from "../api"
import { ChatListContent } from "../components/ChatListContent"
import { useWorkspace } from "../ctx"

export function ChatListPage() {
  const ws = useWorkspace()
  const navigate = useNavigate()
  const isAdmin = ws.currentUser?.role === "admin"

  const [convs, setConvs] = useState<ChatConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showDmPicker, setShowDmPicker] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [dmUser, setDmUser] = useState("")

  const refresh = async () => {
    setLoading(true)
    try {
      setConvs(await listChatConversations())
    } catch {
      // keep existing list on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const channels = convs.filter((c) => c.kind === "channel")
  const dms = convs.filter((c) => c.kind === "dm")

  const handleSelectConv = (c: ChatConversation) => {
    navigate(`/chat/${c.id}`)
  }

  const handleNewChannel = async () => {
    const name = prompt("Channel name:")
    if (!name?.trim()) return
    await createChatChannel(name.trim())
    await refresh()
  }

  const handleDeleteChannel = async (convId: string) => {
    if (!confirm("Delete this channel?")) return
    await deleteChatChannel(convId)
    await refresh()
  }

  const handleOpenDm = async () => {
    const name = dmUser.trim()
    if (!name) return
    const r = await openChatDm(name)
    if (r.conv) {
      setShowDmPicker(false)
      setDmUser("")
      navigate(`/chat/${r.conv.id}`)
      await refresh()
    } else if (r.error) {
      alert(r.error)
    }
  }

  return (
    <div className="h-full w-full bg-white overflow-auto">
      {loading ? (
        <div className="h-full flex items-center justify-center text-sm text-gray-400">
          loading…
        </div>
      ) : (
        <>
          <ChatListContent
            channels={channels}
            dms={dms}
            activeConvId={undefined}
            isAdmin={isAdmin}
            onSelectConv={handleSelectConv}
            onNewChannel={() => setShowNewChannel(true)}
            onNewDm={() => setShowDmPicker(true)}
            onDeleteChannel={isAdmin ? handleDeleteChannel : undefined}
          />

          {/* New channel dialog */}
          {showNewChannel && (
            <NewItemDialog
              title="New channel"
              placeholder="channel name"
              onSubmit={(name) => {
                setShowNewChannel(false)
                createChatChannel(name).then(refresh)
              }}
              onClose={() => setShowNewChannel(false)}
            />
          )}

          {/* New DM dialog */}
          {showDmPicker && (
            <NewItemDialog
              title="New DM"
              placeholder="username"
              value={dmUser}
              onChange={setDmUser}
              onSubmit={handleOpenDm}
              onClose={() => { setShowDmPicker(false); setDmUser("") }}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Simple prompt dialog — text input + submit/cancel. */
function NewItemDialog(props: {
  title: string
  placeholder: string
  value?: string
  onChange?: (v: string) => void
  onSubmit: (v: string) => void
  onClose: () => void
}) {
  const [v, setV] = useState(props.value ?? "")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={props.onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-lg shadow-xl w-80 max-w-[90vw] p-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium text-gray-900">{props.title}</div>
        <input
          type="text"
          autoFocus
          value={props.onChange ? (props.value ?? "") : v}
          onChange={(e) => {
            if (props.onChange) props.onChange(e.target.value)
            else setV(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = props.onChange ? (props.value ?? "") : v
              if (val.trim()) props.onSubmit(val.trim())
            }
          }}
          placeholder={props.placeholder}
          className="h-9 px-3 rounded border border-gray-300 text-sm focus:outline-none focus:border-gray-500"
        />
        <div className="flex justify-end gap-2">
          <button onClick={props.onClose} className="px-3 h-7 rounded text-xs text-gray-500 hover:bg-gray-100">cancel</button>
          <button
            onClick={() => {
              const val = props.onChange ? (props.value ?? "") : v
              if (val.trim()) props.onSubmit(val.trim())
            }}
            className="px-3 h-7 rounded text-xs bg-gray-900 text-white hover:bg-gray-700"
          >create</button>
        </div>
      </div>
    </div>
  )
}
