'use client'

import { useEffect, useRef, useState, type ChangeEvent, type DragEventHandler } from 'react'

type FileSelectionHandler = (files: File[]) => void | Promise<void>

interface UseFileDropzoneOptions {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  onFilesSelected: FileSelectionHandler
}

function hasFilePayload(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types || []).includes('Files')
}

export function useFileDropzone({
  accept,
  multiple = false,
  disabled = false,
  onFilesSelected,
}: UseFileDropzoneOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragDepthRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const resetDragState = () => {
    dragDepthRef.current = 0
    setIsDragging(false)
  }

  useEffect(() => {
    if (disabled) {
      resetDragState()
    }
  }, [disabled])

  const handleFiles = (files: File[]) => {
    if (disabled || files.length === 0) return
    void onFilesSelected(files)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    handleFiles(files)
  }

  const handleDragEnter: DragEventHandler<HTMLElement> = (event) => {
    if (disabled || !hasFilePayload(event.dataTransfer)) return
    event.preventDefault()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver: DragEventHandler<HTMLElement> = (event) => {
    if (disabled || !hasFilePayload(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave: DragEventHandler<HTMLElement> = (event) => {
    if (disabled || !hasFilePayload(event.dataTransfer)) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDrop: DragEventHandler<HTMLElement> = (event) => {
    if (disabled || !hasFilePayload(event.dataTransfer)) return
    event.preventDefault()
    resetDragState()
    handleFiles(Array.from(event.dataTransfer.files || []))
  }

  return {
    isDragging,
    openFilePicker: () => inputRef.current?.click(),
    rootProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    inputProps: {
      ref: inputRef,
      type: 'file' as const,
      accept,
      multiple,
      disabled,
      onChange: handleInputChange,
    },
  }
}
