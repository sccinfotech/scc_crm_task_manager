'use client'

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { normalizeChecklistHtml } from './checklist-html'
import { RichTextBubbleMenu } from './rich-text-bubble-menu'
import { TaskCommentMentionMark, TASK_COMMENT_MENTION_NAMES_META } from './task-comment-mention-mark'
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

type TaskCommentComposerEditorProps = {
  value: string
  onChange: (html: string) => void
  /** Display names used to highlight typed @mentions (cyan) while composing. */
  mentionHighlightNames?: string[]
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
    mentionHighlightNames,
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
      TaskCommentMentionMark,
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
          'prose prose-sm max-w-none px-2.5 pt-2 pb-1.5 text-sm leading-5 text-slate-800 focus:outline-none min-h-[inherit] [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_.task-comment-mention]:font-medium [&_.task-comment-mention]:text-cyan-600',
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
        .insertContent([
          {
            type: 'text',
            text: `@${name}`,
            marks: [{ type: 'taskCommentMention' }],
          },
          { type: 'text', text: ' ' },
        ])
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
    if (!editor) return
    const storage = (editor.storage as unknown as { taskCommentMention?: { highlightNames: string[] } })
      .taskCommentMention
    if (!storage) return
    const next = mentionHighlightNames ?? []
    const prev = storage.highlightNames
    if (prev.length === next.length && prev.every((n, i) => n === next[i])) return
    storage.highlightNames = next
    editor.view.dispatch(editor.state.tr.setMeta(TASK_COMMENT_MENTION_NAMES_META, true))
  }, [editor, mentionHighlightNames])

  useEffect(() => {
    if (editor && normalizedValue !== editor.getHTML()) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false })
    }
  }, [normalizedValue, editor])

  const scrollRootRef = useRef<HTMLDivElement>(null)

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
      <RichTextBubbleMenu editor={editor} scrollRootRef={scrollRootRef} />
      <EditorContent editor={editor} />
    </div>
  )
})
