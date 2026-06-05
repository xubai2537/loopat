/**
 * Shared conversation list — channels + DMs sections, new channel/DM buttons.
 * Used by the sidebar in ChatPage and the full-page ChatListPage for mobile.
 */
import type { ChatConversation } from "../api"

function convDisplayName(conv: ChatConversation): string {
  if (conv.kind === "channel") return conv.name ?? "(unnamed)"
  return conv.peerUserId ?? "(unknown)"
}

function convSigil(conv: ChatConversation): string {
  return conv.kind === "channel" ? "#" : "@"
}

export interface ChatListContentProps {
  channels: ChatConversation[]
  dms: ChatConversation[]
  activeConvId?: string
  isAdmin?: boolean
  onSelectConv: (conv: ChatConversation) => void
  onNewChannel: () => void
  onNewDm: () => void
  onDeleteChannel?: (convId: string) => void
}

export function ChatListContent({
  channels,
  dms,
  activeConvId,
  isAdmin,
  onSelectConv,
  onNewChannel,
  onNewDm,
  onDeleteChannel,
}: ChatListContentProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto py-2">
        {/* Channels */}
        <div className="px-3 mt-1 mb-1 text-xs text-gray-500 flex items-center justify-between">
          <span>Channels</span>
          <button
            type="button"
            onClick={onNewChannel}
            className="text-gray-500 hover:text-gray-900 text-base leading-none"
            title="new channel"
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {channels.map((c) => (
            <ConvRow
              key={c.id}
              conv={c}
              active={c.id === activeConvId}
              onClick={() => onSelectConv(c)}
              onDelete={
                isAdmin && onDeleteChannel
                  ? () => onDeleteChannel(c.id)
                  : undefined
              }
            />
          ))}
          {channels.length === 0 && (
            <div className="mx-2 px-2 py-1 text-[11px] text-gray-400">
              no channels yet
            </div>
          )}
        </div>

        {/* Direct messages */}
        <div className="px-3 mt-4 mb-1 text-xs text-gray-500 flex items-center justify-between">
          <span>Direct messages</span>
          <button
            type="button"
            onClick={onNewDm}
            className="text-gray-500 hover:text-gray-900 text-base leading-none"
            title="new DM"
          >
            +
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {dms.map((c) => (
            <ConvRow
              key={c.id}
              conv={c}
              active={c.id === activeConvId}
              onClick={() => onSelectConv(c)}
            />
          ))}
          {dms.length === 0 && (
            <div className="mx-2 px-2 py-1 text-[11px] text-gray-400">
              no DMs yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** A single conversation row — channel or DM. */
function ConvRow(props: {
  conv: ChatConversation
  active: boolean
  onClick: () => void
  onDelete?: () => void
}) {
  const c = props.conv
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={props.onClick}
        className={
          props.active
            ? "mx-2 px-2 py-1 w-[calc(100%-1rem)] rounded text-[13px] flex items-center gap-2 bg-gray-100 text-gray-900"
            : "mx-2 px-2 py-1 w-[calc(100%-1rem)] rounded text-[13px] flex items-center gap-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
        }
      >
        <span className="text-gray-400">{convSigil(c)}</span>
        <span className="truncate flex-1 text-left">{convDisplayName(c)}</span>
        {c.unread > 0 && (
          <span className="text-[11px] px-1.5 rounded-full bg-gray-200 text-gray-700">
            {c.unread}
          </span>
        )}
      </button>
      {props.onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            props.onDelete!()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 text-xs px-1"
          title="delete channel (admin)"
        >
          ×
        </button>
      )}
    </div>
  )
}
