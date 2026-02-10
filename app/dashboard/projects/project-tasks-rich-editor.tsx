'use client'

import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect } from 'react'

interface ProjectTasksRichEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
  editable?: boolean
}

function MenuBar({ editor }: { editor: Editor | null }) {
  if (!editor) return null
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50/50 px-2 py-1 rounded-t-lg">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('bold') ? 'bg-slate-200' : ''}`}
        title="Bold"
      >
        <span className="font-bold text-sm">B</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('italic') ? 'bg-slate-200' : ''}`}
        title="Italic"
      >
        <span className="italic text-sm">I</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('bulletList') ? 'bg-slate-200' : ''}`}
        title="Bullet list"
      >
        <span className="text-sm">• List</span>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`p-1.5 rounded hover:bg-slate-200 ${editor.isActive('orderedList') ? 'bg-slate-200' : ''}`}
        title="Numbered list"
      >
        <span className="text-sm">1. List</span>
      </button>
    </div>
  )
}

export function ProjectTasksRichEditor({
  value,
  onChange,
  placeholder = 'Add description…',
  minHeight = '120px',
  editable = true,
}: ProjectTasksRichEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[80px] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
  }, [value, editor])

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} style={{ minHeight }} />
    </div>
  )
}
