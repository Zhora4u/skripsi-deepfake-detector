'use client'

import { useState } from 'react'
import { Upload, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UploadSectionProps {
  onFileSelect: (file: File) => Promise<boolean>
  onInvalidFile: (msg?: string) => void
}

export default function UploadSection({
  onFileSelect,
  onInvalidFile,
}: UploadSectionProps) {
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      const accepted = await onFileSelect(file)
      if (accepted) setFileName(file.name)
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const accepted = await onFileSelect(file)
      if (accepted) setFileName(file.name)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-6 md:p-8 text-center transition-all duration-200 ${
          dragActive
            ? 'border-primary bg-primary/8'
            : 'border-border/80 hover:border-primary/40 hover:bg-secondary/40 bg-secondary/30'
        } ${fileName ? 'bg-primary/4 border-primary/60' : ''}`}
      >
        {fileName ? (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">File berhasil diupload</p>
            <p className="text-xs text-muted-foreground mb-4 truncate max-w-full px-4">
              {fileName}
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Letakkan file di sini</p>
            <p className="text-xs text-muted-foreground mb-4">atau klik untuk memilih</p>
          </>
        )}
        <input
          type="file"
          accept="*/*"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload">
          <Button variant="outline" size="sm" asChild className="rounded-lg">
            <span className="cursor-pointer">
              {fileName ? 'Ganti File' : 'Pilih File'}
            </span>
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF, MP4, WebM</p>
        <p className="text-xs text-muted-foreground/60">Max 20MB &middot; Video max 1 menit</p>
      </div>
    </div>
  )
}
