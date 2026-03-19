const CHECKBOX_SELECTOR = 'input[type="checkbox"]'
const TASK_ITEM_SELECTOR = 'li[data-type="taskItem"]'
const TASK_LIST_SELECTOR = 'ul[data-type="taskList"]'

const BLOCK_TAGS = new Set([
  'article',
  'aside',
  'blockquote',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'ul',
])

type LooseChecklistItem = {
  checked: boolean
  contentHtml: string
  sourceBlock: HTMLElement
  textBlock: HTMLElement | null
  nextIndex: number
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasMeaningfulContent(element: HTMLElement) {
  if (normalizeText(element.textContent)) return true
  return Boolean(element.querySelector('img, video, iframe, table, pre, code'))
}

function stripCheckboxDecorations(element: HTMLElement) {
  element.querySelectorAll(CHECKBOX_SELECTOR).forEach((input) => input.remove())
  element.querySelectorAll('label').forEach((label) => {
    if (!hasMeaningfulContent(label as HTMLElement)) label.remove()
  })
}

function getTaskContentHtml(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement
  stripCheckboxDecorations(clone)

  if (!hasMeaningfulContent(clone)) return ''

  const tagName = clone.tagName.toLowerCase()
  if (BLOCK_TAGS.has(tagName) && tagName !== 'div' && tagName !== 'section' && tagName !== 'article' && tagName !== 'li') {
    return clone.outerHTML
  }

  const childElements = Array.from(clone.children) as HTMLElement[]
  if (childElements.length > 0 && childElements.every((child) => BLOCK_TAGS.has(child.tagName.toLowerCase()))) {
    return clone.innerHTML
  }

  return `<p>${clone.innerHTML}</p>`
}

function findLooseCheckbox(element: HTMLElement) {
  const checkbox = (element.matches(CHECKBOX_SELECTOR) ? element : element.querySelector(CHECKBOX_SELECTOR)) as HTMLInputElement | null
  if (!checkbox) return null
  if (checkbox.closest(TASK_ITEM_SELECTOR)) return null
  return checkbox
}

function getLooseChecklistItem(children: HTMLElement[], startIndex: number) {
  const sourceBlock = children[startIndex]
  if (!sourceBlock) return null
  if (sourceBlock.matches(TASK_LIST_SELECTOR) || sourceBlock.matches(TASK_ITEM_SELECTOR)) return null

  const checkbox = findLooseCheckbox(sourceBlock)
  if (!checkbox) return null

  const checked = checkbox.checked || checkbox.hasAttribute('checked') || checkbox.getAttribute('aria-checked') === 'true'
  let contentHtml = getTaskContentHtml(sourceBlock)
  let textBlock: HTMLElement | null = null
  let nextIndex = startIndex + 1

  if (!contentHtml) {
    for (let index = startIndex + 1; index < children.length; index += 1) {
      const candidate = children[index]
      if (!candidate) break
      if (candidate.matches(TASK_LIST_SELECTOR) || candidate.matches(TASK_ITEM_SELECTOR)) break

      const candidateCheckbox = findLooseCheckbox(candidate)
      if (candidateCheckbox) break

      if (!hasMeaningfulContent(candidate)) {
        nextIndex = index + 1
        continue
      }

      textBlock = candidate
      contentHtml = getTaskContentHtml(candidate)
      nextIndex = index + 1
      break
    }
  }

  return {
    checked,
    contentHtml: contentHtml || '<p></p>',
    sourceBlock,
    textBlock,
    nextIndex,
  } satisfies LooseChecklistItem
}

function buildTaskItem(documentRef: Document, item: LooseChecklistItem) {
  const listItem = documentRef.createElement('li')
  listItem.setAttribute('data-type', 'taskItem')
  listItem.setAttribute('data-checked', item.checked ? 'true' : 'false')

  const label = documentRef.createElement('label')
  label.contentEditable = 'false'

  const input = documentRef.createElement('input')
  input.type = 'checkbox'
  input.checked = item.checked
  if (item.checked) {
    input.setAttribute('checked', 'checked')
  }

  const span = documentRef.createElement('span')
  label.append(input, span)

  const content = documentRef.createElement('div')
  content.innerHTML = item.contentHtml

  listItem.append(label, content)
  return listItem
}

function normalizeChecklistContainer(container: HTMLElement | HTMLBodyElement) {
  const children = Array.from(container.children) as HTMLElement[]

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (!child || !child.isConnected) continue

    const firstItem = getLooseChecklistItem(children, index)
    if (!firstItem) {
      if (!child.matches(TASK_LIST_SELECTOR) && !child.matches(TASK_ITEM_SELECTOR)) {
        normalizeChecklistContainer(child)
      }
      continue
    }

    const group: LooseChecklistItem[] = []
    let nextIndex = index

    while (nextIndex < children.length) {
      const nextItem = getLooseChecklistItem(children, nextIndex)
      if (!nextItem) break
      group.push(nextItem)
      nextIndex = nextItem.nextIndex
    }

    if (group.length === 0) continue

    const list = container.ownerDocument.createElement('ul')
    list.setAttribute('data-type', 'taskList')

    group.forEach((item) => {
      list.append(buildTaskItem(container.ownerDocument, item))
    })

    const anchor = group[0]?.sourceBlock
    if (!anchor?.parentNode) continue

    anchor.parentNode.insertBefore(list, anchor)

    group.forEach((item) => {
      item.sourceBlock.remove()
      item.textBlock?.remove()
    })

    index = nextIndex - 1
  }
}

export function normalizeChecklistHtml(html: string | null | undefined) {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return html
  if (!html.includes('checkbox')) return html

  const documentRef = new DOMParser().parseFromString(html, 'text/html')
  normalizeChecklistContainer(documentRef.body)
  return documentRef.body.innerHTML
}
