'use client'

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { normalizeChecklistHtml } from './checklist-html'
import { RichTextBubbleMenu } from './rich-text-bubble-menu'

export type RequirementDescriptionEditorProps = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeightPx?: number
  maxHeightPx?: number
  error?: boolean
}

/**
 * Rich description field aligned with task comment composer: TipTap + floating bubble menu (no @mentions).
 */
export function RequirementDescriptionEditor({
  value,
  onChange,
  placeholder = 'Add requirement details, notes, or scope context.',
  minHeightPx = 150,
  maxHeightPx = 320,
  error = false,
}: RequirementDescriptionEditorProps) {
  const scrollRootRef = useRef<HTMLDivElement>(null)
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
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
    ],
    content: normalizedValue,
    editable: true,
    editorProps: {
      transformPastedHTML: (html) => normalizeChecklistHtml(html),
      attributes: {
        class:
          'prose prose-sm max-w-none px-2.5 pt-2 pb-1.5 text-sm leading-5 text-slate-800 focus:outline-none min-h-[inherit] [&_p]:my-0 [&_p+p]:mt-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (editor && normalizedValue !== editor.getHTML()) {
      editor.commands.setContent(normalizedValue, { emitUpdate: false })
    }
  }, [normalizedValue, editor])

  if (!editor) {
    return (
      <div
        className="animate-pulse rounded-xl bg-slate-50"
        style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
      />
    )
  }

  return (
    <div
      className={`rounded-xl border bg-white overflow-hidden transition-colors duration-200 focus-within:ring-2 focus-within:ring-[#06B6D4]/20 focus-within:border-[#06B6D4] ${
        error ? 'border-red-400 ring-2 ring-red-400/20' : 'border-slate-200'
      }`}
    >
      <div
        ref={scrollRootRef}
        className="relative min-h-0 overflow-y-auto scrollbar-hide"
        style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
      >
        <RichTextBubbleMenu editor={editor} scrollRootRef={scrollRootRef} />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
