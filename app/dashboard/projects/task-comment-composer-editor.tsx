'use client'

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { normalizeChecklistHtml } from './checklist-html'
import type { TaskAssignee } from '@/lib/projects/tasks-actions'

export type TaskCommentMentionSession = { from: number; to: number; query: string }

export type TaskCommentComposerEditorHandle = {
  applyMention: (user: TaskAssignee) => void
  cancelMention: () => void
  clear: () => void
}

function getMentionLabel(user: TaskAssignee) {
  return user.full_name ?? user.email ?? user.id
}

function getMentionSession(editor: Editor): TaskCommentMentionSession | null {
  const { state } = editor
  const { $from } = state.selection
  if (!$from.parent.isTextblock) return null
  const offset = $from.parentOffset
  const textBefore = $from.parent.textBetween(0, offset, '\ufffc', ' ')
  const atInText = textBefore.lastIndexOf('@')
  if (atInText < 0) return null
  const query = textBefore.slice(atInText + 1)
  if (/\s/.test(query)) return null
  const start = $from.start() + atInText
  const end = $from.start() + offset
  return { from: start, to: end, query }
}

const bubbleBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30'

function isActive(editor: Editor, name: string, attrs?: Record<string, unknown>) {
  return editor.isActive(name, attrs)
}

const BUBBLE_COLORS = ['#64748b', '#dc2626', '#16a34a', '#2563eb', '#7c3aed']

type TaskCommentComposerEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  minHeightPx?: number
  maxHeightPx?: number
  onMentionSessionChange?: (session: TaskCommentMentionSession | null) => void
  mentionListActive?: boolean
  onMentionListNavigate?: (direction: 'up' | 'down') => void
  onMentionListPick?: () => void
  onMentionListClose?: () => void
  onMentionApplied?: (user: TaskAssignee) => void
}

export const TaskCommentComposerEditor = forwardRef<
  TaskCommentComposerEditorHandle,
  TaskCommentComposerEditorProps
>(function TaskCommentComposerEditor(
  {
    value,
    onChange,
    placeholder = 'Add a comment… Type @ to mention',
    disabled = false,
    minHeightPx = 72,
    maxHeightPx = 200,
    onMentionSessionChange,
    mentionListActive = false,
    onMentionListNavigate,
    onMentionListPick,
    onMentionListClose,
    onMentionApplied,
  },
  ref
) {
  const mentionSessionRef = useRef<TaskCommentMentionSession | null>(null)
  const normalizedValue = normalizeChecklistHtml(value || '')

  const emitMentionSession = useCallback(
    (editor: Editor) => {
      const session = getMentionSession(editor)
      mentionSessionRef.current = session
      onMentionSessionChange?.(session)
    },
    [onMentionSessionChange]
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({ placeholder }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
    ],
    content: normalizedValue,
    editable: !disabled,
    editorProps: {
      transformPastedHTML: (html) => normalizeChecklistHtml(html),
      attributes: {
        class:
          'prose prose-sm max-w-none px-2.5 pt-2 pb-1.5 text-sm leading-5 text-slate-800 focus:outline-none min-h-[inherit] [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5',
      },
      handleKeyDown: (_view, event) => {
        if (!mentionListActive) return false
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          onMentionListNavigate?.('down')
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          onMentionListNavigate?.('up')
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          onMentionListPick?.()
          return true
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          onMentionListClose?.()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
      emitMentionSession(editor)
    },
    onSelectionUpdate: ({ editor }) => {
      emitMentionSession(editor)
    },
  })

  useImperativeHandle(ref, () => ({
    applyMention: (user: TaskAssignee) => {
      if (!editor) return
      const session = mentionSessionRef.current ?? getMentionSession(editor)
      if (!session) return
      const name = getMentionLabel(user)
      editor
        .chain()
        .focus()
        .deleteRange({ from: session.from, to: session.to })
        .insertContent(`@${name} `)
        .run()
      onMentionApplied?.(user)
      mentionSessionRef.current = null
      onMentionSessionChange?.(null)
    },
    cancelMention: () => {
      if (!editor) return
      const session = mentionSessionRef.current ?? getMentionSession(editor)
      if (!session) return
      editor.chain().focus().deleteRange({ from: session.from, to: session.to }).run()
      mentionSessionRef.current = null
      onMentionSessionChange?.(null)
    },
    clear: () => {
      if (!editor) return
      editor.commands.clearContent(true)
      mentionSessionRef.current = null
      onMentionSessionChange?.(null)
    },
  }))

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  useEffect(() => {
    if (editor && normalizedValue !== editor.getHTML()) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false })
    }
  }, [normalizedValue, editor])

  const scrollRootRef = useRef<HTMLDivElement>(null)
  const [bubbleScrollTarget, setBubbleScrollTarget] = useState<HTMLElement | Window | null>(null)

  /** TipTap positions this root node; className applies to an inner div, so z-index must be set here. */
  const bubbleMenuRootRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      el.style.zIndex = '10060'
    }
  }, [])

  useLayoutEffect(() => {
    if (!editor) return
    const el = scrollRootRef.current
    setBubbleScrollTarget(el ?? (typeof window !== 'undefined' ? window : null))
  }, [editor])

  const bubbleMenuOptions = useMemo(
    () => ({
      strategy: 'fixed' as const,
      placement: 'top' as const,
      offset: 10,
      flip: {
        padding: 12,
        fallbackPlacements: ['bottom', 'top', 'left', 'right'],
      },
      shift: { padding: 12, crossAxis: true },
      scrollTarget: bubbleScrollTarget ?? (typeof window !== 'undefined' ? window : undefined),
    }),
    [bubbleScrollTarget]
  )

  if (!editor) {
    return (
      <div
        className="animate-pulse rounded-t-xl bg-slate-50"
        style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
      />
    )
  }

  return (
    <div
      ref={scrollRootRef}
      className="relative min-h-0 overflow-y-auto scrollbar-hide"
      style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
    >
      <BubbleMenu
        ref={bubbleMenuRootRef}
        editor={editor}
        appendTo={() => document.body}
        options={bubbleMenuOptions}
        className="flex max-w-[min(100vw-1.5rem,28rem)] flex-wrap items-center gap-0.5 rounded-xl border border-slate-200 bg-white px-1.5 py-1 shadow-xl pointer-events-auto"
      >
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'bulletList') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Bulleted list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'orderedList') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'bold') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'italic') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'underline') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'strike') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'code') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
          </svg>
        </button>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'highlight') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Highlight"
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M15.24 2.86l-3.5 3.5-1.5-1.5-1.41 1.41 1.5 1.5L3 17.25V21h3.75L20.78 9.94l-1.41-1.41-1.5 1.5-3.5-3.5 1.5-1.5-1.42-1.42-1.5 1.5z" />
          </svg>
        </button>
        <div className="mx-0.5 flex items-center gap-0.5 border-l border-slate-200 pl-1.5" role="group" aria-label="Text color">
          {BUBBLE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Color ${c}`}
              className="h-6 w-6 shrink-0 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30"
              style={{ backgroundColor: c }}
              onClick={() => editor.chain().focus().setColor(c).run()}
            />
          ))}
          <button
            type="button"
            title="Default color"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            A
          </button>
        </div>
        <button
          type="button"
          className={`${bubbleBtn} ${isActive(editor, 'link') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Link"
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined
            const url =
              typeof window !== 'undefined'
                ? window.prompt('Link URL', prev || 'https://')
                : ''
            if (url === null) return
            const trimmed = url.trim()
            if (trimmed) editor.chain().focus().setLink({ href: trimmed }).run()
            else editor.chain().focus().unsetLink().run()
          }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  )
})
