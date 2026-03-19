'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { TaskList } from '@tiptap/extension-list/task-list'
import { TaskItem } from '@tiptap/extension-list/task-item'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { normalizeChecklistHtml } from './checklist-html'

interface ProjectTasksRichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  editable?: boolean
  /** When true, shows error state (red border/ring) */
  error?: boolean
  /** Extra class for the wrapper (e.g. rounded-xl for form consistency) */
  wrapperClassName?: string
  /** Id for the wrapper (for label htmlFor) */
  id?: string
}

const toolbarBtnBase =
  'flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:ring-offset-1'

function isActive(editor: Editor, name: string, attrs?: Record<string, unknown>) {
  return editor.isActive(name, attrs)
}

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Gray', value: '#64748b' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Purple', value: '#7c3aed' },
]

const TaskItemBackspaceGuard = Extension.create({
  name: 'taskItemBackspaceGuard',
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state } = this.editor
        const { selection } = state
        if (!selection.empty) return false

        const { $from } = selection
        if (!$from.parent.isTextblock) return false
        if ($from.parentOffset !== 0) return false

        // Find the closest taskItem ancestor.
        let taskItemDepth: number | null = null
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'taskItem') {
            taskItemDepth = d
            break
          }
        }
        if (taskItemDepth == null) return false

        const taskItemNode = $from.node(taskItemDepth)

        // If the task item has content, prevent "lifting" out of the task list
        // which makes it look like the checkbox disappeared.
        // Allow default behavior when the item is empty.
        if (taskItemNode.content.size > 2) {
          return true
        }

        return false
      },
    }
  },
})

function MenuBar({ editor }: { editor: Editor | null }) {
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [headingOpen, setHeadingOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const [headingDropdownRect, setHeadingDropdownRect] = useState<{ top: number; left: number } | null>(null)
  const [colorDropdownRect, setColorDropdownRect] = useState<{ top: number; left: number } | null>(null)
  const linkSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const linkButtonRef = useRef<HTMLButtonElement>(null)
  const headingButtonRef = useRef<HTMLButtonElement>(null)
  const colorButtonRef = useRef<HTMLButtonElement>(null)
  const [linkPopoverRect, setLinkPopoverRect] = useState<{ top: number; left: number } | null>(null)

  const updateLinkPopoverPosition = useCallback(() => {
    if (!linkButtonRef.current) return
    const rect = linkButtonRef.current.getBoundingClientRect()
    const popoverW = 220
    const pad = 12
    let left = rect.left
    if (left + popoverW > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - popoverW - pad)
    setLinkPopoverRect({ top: rect.bottom + 4, left })
  }, [])

  const updateHeadingDropdownPosition = useCallback(() => {
    if (!headingButtonRef.current) return
    const rect = headingButtonRef.current.getBoundingClientRect()
    const dropdownW = 120
    const pad = 12
    let left = rect.left
    if (left + dropdownW > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - dropdownW - pad)
    setHeadingDropdownRect({ top: rect.bottom + 4, left })
  }, [])

  const updateColorDropdownPosition = useCallback(() => {
    if (!colorButtonRef.current) return
    const rect = colorButtonRef.current.getBoundingClientRect()
    const dropdownW = 140
    const pad = 12
    let left = rect.left
    if (left + dropdownW > window.innerWidth - pad) left = Math.max(pad, window.innerWidth - dropdownW - pad)
    setColorDropdownRect({ top: rect.bottom + 4, left })
  }, [])

  useEffect(() => {
    if (showLinkPopover) {
      linkInputRef.current?.focus()
      updateLinkPopoverPosition()
    } else {
      setLinkPopoverRect(null)
    }
  }, [showLinkPopover, updateLinkPopoverPosition])

  useEffect(() => {
    if (headingOpen) {
      updateHeadingDropdownPosition()
    } else {
      setHeadingDropdownRect(null)
    }
  }, [headingOpen, updateHeadingDropdownPosition])

  useEffect(() => {
    if (colorOpen) {
      updateColorDropdownPosition()
    } else {
      setColorDropdownRect(null)
    }
  }, [colorOpen, updateColorDropdownPosition])

  useEffect(() => {
    if (!showLinkPopover || !linkButtonRef.current) return
    const update = () => updateLinkPopoverPosition()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [showLinkPopover, updateLinkPopoverPosition])

  useEffect(() => {
    if (!headingOpen || !headingButtonRef.current) return
    const update = () => updateHeadingDropdownPosition()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [headingOpen, updateHeadingDropdownPosition])

  useEffect(() => {
    if (!colorOpen || !colorButtonRef.current) return
    const update = () => updateColorDropdownPosition()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [colorOpen, updateColorDropdownPosition])

  if (!editor) return null

  const openLinkPopover = () => {
    // Store selection before focus moves to the URL input
    const { from, to } = editor.state.selection
    linkSelectionRef.current = { from, to }
    const href = editor.getAttributes('link').href
    if (href) setLinkUrl(href)
    setShowLinkPopover(true)
  }

  const setLink = () => {
    const url = linkUrl.trim() || (typeof window !== 'undefined' ? window.prompt('URL:', editor.getAttributes('link').href) : '')
    const stored = linkSelectionRef.current
    linkSelectionRef.current = null
    let chain = editor.chain().focus()
    if (stored && stored.from !== stored.to) {
      chain = chain.setTextSelection({ from: stored.from, to: stored.to })
    }
    if (url) {
      chain.setLink({ href: url }).run()
    } else {
      chain.unsetLink().run()
    }
    setLinkUrl('')
    setShowLinkPopover(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200/80 bg-gradient-to-b from-slate-50 to-white px-2 py-2 rounded-t-xl">
      {/* Text style: Bold, Italic, Underline, Strikethrough */}
      <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5" role="group" aria-label="Text style">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'bold') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Bold"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'italic') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Italic"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'underline') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Underline"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'strike') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Strikethrough"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
          </svg>
        </button>
      </div>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Code: inline + block */}
      <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5" role="group" aria-label="Code">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'code') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Inline code"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'codeBlock') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Code block"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h7" />
          </svg>
        </button>
      </div>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Text / Headings — dropdown portaled to body for top layer */}
      <div className="relative" role="group" aria-label="Block format">
        <button
          ref={headingButtonRef}
          type="button"
          onClick={() => setHeadingOpen((o) => !o)}
          className={`${toolbarBtnBase} min-w-[4rem] gap-0.5 px-2 ${headingOpen ? 'bg-slate-200' : ''}`}
          title="Heading level"
        >
          <span className="text-xs font-medium truncate">
            {isActive(editor, 'heading', { level: 1 }) ? 'H1' : isActive(editor, 'heading', { level: 2 }) ? 'H2' : isActive(editor, 'heading', { level: 3 }) ? 'H3' : 'Text'}
          </span>
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {typeof document !== 'undefined' &&
          headingOpen &&
          headingDropdownRect &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setHeadingOpen(false)} />
              <div
                className="fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl py-1 min-w-[7rem]"
                style={{ top: headingDropdownRect.top, left: headingDropdownRect.left }}
              >
                {[
                  { label: 'Paragraph', run: () => editor.chain().focus().setParagraph().run() },
                  { label: 'Heading 1', run: () => editor.chain().focus().setHeading({ level: 1 }).run() },
                  { label: 'Heading 2', run: () => editor.chain().focus().setHeading({ level: 2 }).run() },
                  { label: 'Heading 3', run: () => editor.chain().focus().setHeading({ level: 3 }).run() },
                ].map(({ label, run }) => (
                  <button key={label} type="button" onClick={() => { run(); setHeadingOpen(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800">
                    {label}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
      </div>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Blockquote */}
      <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5" role="group" aria-label="Quote">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'blockquote') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Quote"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
          </svg>
        </button>
      </div>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Lists */}
      <div className="flex items-center gap-0.5 rounded-lg bg-slate-100/60 p-0.5" role="group" aria-label="Lists">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'bulletList') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Bullet list"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'orderedList') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Numbered list"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`${toolbarBtnBase} ${isActive(editor, 'taskList') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Task list (checklist)"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>
      </div>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Highlight */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={`${toolbarBtnBase} ${isActive(editor, 'highlight') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
        title="Highlight"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path d="M15.24 2.86l-3.5 3.5-1.5-1.5-1.41 1.41 1.5 1.5L3 17.25V21h3.75L20.78 9.94l-1.41-1.41-1.5 1.5-3.5-3.5 1.5-1.5-1.42-1.42-1.5 1.5z" />
        </svg>
      </button>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Text color — dropdown portaled to body for top layer */}
      <div className="relative" role="group" aria-label="Text color">
        <button
          ref={colorButtonRef}
          type="button"
          onClick={() => setColorOpen((o) => !o)}
          className={`${toolbarBtnBase} ${editor.isActive('textStyle') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Text color"
        >
          <span className="text-sm font-medium">A</span>
          <span className="w-3 h-3 rounded border border-slate-300 ml-0.5" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#374151' }} aria-hidden />
          <svg className="h-3 w-3 shrink-0 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {typeof document !== 'undefined' &&
          colorOpen &&
          colorDropdownRect &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[9998]" aria-hidden onClick={() => setColorOpen(false)} />
              <div
                className="fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl p-2 min-w-[8rem]"
                style={{ top: colorDropdownRect.top, left: colorDropdownRect.left }}
              >
                {TEXT_COLORS.map(({ label, value }) => (
                  <button
                    key={label + (value || 'default')}
                    type="button"
                    onClick={() => {
                      if (value) editor.chain().focus().setColor(value).run()
                      else editor.chain().focus().unsetColor().run()
                      setColorOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-slate-800 flex items-center gap-2 rounded"
                  >
                    <span className="w-4 h-4 rounded border border-slate-200 shrink-0" style={{ backgroundColor: value || '#e2e8f0' }} />
                    {label}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
      </div>
      <div className="w-px h-6 bg-slate-200/80 mx-0.5" aria-hidden />

      {/* Link */}
      <div className="relative" role="group" aria-label="Link">
        <button
          ref={linkButtonRef}
          type="button"
          onClick={() => {
            if (showLinkPopover) {
              setShowLinkPopover(false)
              setLinkUrl('')
            } else {
              openLinkPopover()
            }
          }}
          className={`${toolbarBtnBase} ${isActive(editor, 'link') ? 'bg-[#06B6D4]/15 text-[#0891b2]' : ''}`}
          title="Link"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
        {typeof document !== 'undefined' &&
          showLinkPopover &&
          linkPopoverRect &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998]"
                aria-hidden
                onClick={() => {
                  setShowLinkPopover(false)
                  setLinkUrl('')
                }}
              />
              <div
                className="fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl p-2 flex items-center gap-2 min-w-[220px] max-w-[min(280px,calc(100vw-24px))]"
                style={{ top: linkPopoverRect.top, left: linkPopoverRect.left }}
              >
                <input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setLink()
                    if (e.key === 'Escape') setShowLinkPopover(false)
                  }}
                  placeholder="https://..."
                  className="flex-1 min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#06B6D4]/30 focus:border-[#06B6D4]"
                />
                <button
                  type="button"
                  onClick={setLink}
                  className="shrink-0 rounded px-2 py-1.5 text-sm font-medium bg-[#06B6D4] text-white hover:bg-[#0891b2]"
                >
                  Apply
                </button>
              </div>
            </>,
            document.body
          )}
      </div>
    </div>
  )
}

export function ProjectTasksRichEditor({
  value,
  onChange,
  placeholder = 'Add description…',
  minHeight = '180px',
  editable = true,
  error = false,
  wrapperClassName = '',
  id,
}: ProjectTasksRichEditorProps) {
  const normalizedValue = normalizeChecklistHtml(value || '')

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
      TaskItemBackspaceGuard,
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
    ],
    content: normalizedValue,
    editable,
    editorProps: {
      transformPastedHTML: (html) => normalizeChecklistHtml(html),
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[80px] px-3 py-2 focus:outline-none rich-editor-content',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && normalizedValue !== editor.getHTML()) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false })
    }
  }, [normalizedValue, editor])

  return (
    <div
      id={id}
      role="group"
      aria-label={id ? undefined : 'Description'}
      className={`rich-editor-root rounded-xl border bg-white overflow-hidden transition-colors duration-200 focus-within:ring-2 focus-within:ring-[#06B6D4]/20 focus-within:border-[#06B6D4] ${
        error ? 'border-red-400 ring-2 ring-red-400/20' : 'border-slate-200'
      } ${wrapperClassName}`.trim()}
    >
      <MenuBar editor={editor} />
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  )
}
