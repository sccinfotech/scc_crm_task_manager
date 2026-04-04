import { Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

const MENTION_DECO_PLUGIN_KEY = new PluginKey<DecorationSet>('taskCommentMentionDeco')

export const TASK_COMMENT_MENTION_NAMES_META = 'taskCommentMentionNamesUpdated'

const MENTION_DECO_CLASS = 'task-comment-mention font-medium text-cyan-600'

function isMentionBoundary(c: string | undefined) {
  if (c === undefined) return true
  return /\s/.test(c) || /[.,;:!?'")\]}]/.test(c)
}

function buildMentionDecorations(doc: PMNode, names: string[]): DecorationSet {
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length)
  if (sorted.length === 0) return DecorationSet.empty

  const decos: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText) return
    if (node.marks.some((m) => m.type.name === 'taskCommentMention')) return

    const text = node.text ?? ''
    let i = 0
    while (i < text.length) {
      if (text[i] !== '@') {
        i++
        continue
      }
      let matchedLen = 0
      for (const name of sorted) {
        const needle = '@' + name
        if (!text.startsWith(needle, i)) continue
        const after = text[i + needle.length]
        if (!isMentionBoundary(after)) continue
        matchedLen = needle.length
        decos.push(
          Decoration.inline(pos + i, pos + i + needle.length, {
            class: MENTION_DECO_CLASS,
            title: name,
          })
        )
        break
      }
      i += matchedLen || 1
    }
  })

  return DecorationSet.create(doc, decos)
}

/** Renders @mentions in cyan while typing; serializes to HTML for storage. */
export const TaskCommentMentionMark = Mark.create({
  name: 'taskCommentMention',
  inclusive: false,

  addStorage() {
    return {
      highlightNames: [] as string[],
    }
  },

  addProseMirrorPlugins() {
    const extension = this
    return [
      new Plugin({
        key: MENTION_DECO_PLUGIN_KEY,
        state: {
          init(_, { doc }) {
            return buildMentionDecorations(doc, extension.storage.highlightNames)
          },
          apply(tr, old, _oldState, newState) {
            if (tr.getMeta(TASK_COMMENT_MENTION_NAMES_META) || tr.docChanged) {
              return buildMentionDecorations(newState.doc, extension.storage.highlightNames)
            }
            return old.map(tr.mapping, newState.doc)
          },
        },
        props: {
          decorations(state) {
            return MENTION_DECO_PLUGIN_KEY.getState(state)
          },
        },
      }),
    ]
  },

  parseHTML() {
    return [{ tag: 'span[data-task-comment-mention]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-task-comment-mention': '',
        class: MENTION_DECO_CLASS,
      }),
      0,
    ]
  },
})
