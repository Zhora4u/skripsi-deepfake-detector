'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield, Upload, Brain, BarChart3, RotateCcw, FileWarning } from 'lucide-react'
import Header from '@/components/header'
import Footer from '@/components/footer'
import UploadSection from '@/components/upload-section'
import AnalysisPanel from '@/components/analysis-panel'
import { toast } from '@/hooks/use-toast'

export default function Home() {
  const [mediaPreview, setMediaPreview] = useState<string>('')
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'file' | null>(null)
  const [mediaName, setMediaName] = useState<string>('')
  const [scanning, setScanning] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const analyzeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mediaPreview) {
      setTimeout(() => {
        analyzeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 300)
    }
  }, [mediaPreview])

  const readFileAsDataURL = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string)
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
      reader.readAsDataURL(file)
    })
  }, [])

  const handleFileSelect = async (file: File) => {
    try {
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const dataUrl = await readFileAsDataURL(file)
      setMediaPreview(dataUrl)
      setMediaName(file.name)
      setMediaType(isVideo ? 'video' : isImage ? 'image' : 'file')
    } catch (err) {
      console.error('[Upload Error]', err)
    }
  }

  const handleClear = () => {
    setMediaPreview('')
    setMediaType(null)
    setMediaName('')
    setScanning(false)
    setResetKey((k) => k + 1)
  }

  const handleInvalidFile = (msg?: string) => {
    toast({
      title: 'File tidak valid',
      description: msg || 'Terjadi kesalahan saat memproses file',
      variant: 'destructive',
    })
  }

  return (
    <div className="min-h-screen text-foreground relative">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/15" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
      <Header />
      <main className="container mx-auto px-4 py-12 relative">
        {!mediaPreview ? (
          <div className="space-y-10">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 border border-primary/20 px-4 py-1.5 text-xs font-semibold text-primary tracking-wider uppercase">
                <Shield className="h-3.5 w-3.5" />
                DeepFake Detector
              </div>
              <h2 className="text-4xl font-heading font-bold text-foreground tracking-tight">Deteksi DeepFake</h2>
              <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto leading-relaxed">
                Upload gambar atau video untuk memeriksa apakah asli atau hasil AI menggunakan deep learning.
              </p>
            </div>

            <div className="max-w-xl mx-auto">
              <UploadSection
                onFileSelect={handleFileSelect}
                onInvalidFile={handleInvalidFile}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4">
                <h3 className="text-xs font-heading font-bold text-foreground mb-2 flex items-center gap-2">
                  <Upload className="h-3.5 w-3.5 text-primary" />
                  Unggah Berkas
                </h3>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">Letakkan gambar atau video (JPG, PNG, GIF, MP4, WebM) — maks 20MB atau 1 menit.</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4">
                <h3 className="text-xs font-heading font-bold text-foreground mb-2 flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  Analisis AI
                </h3>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">Model AI memindai setiap detail dengan presisi tinggi.</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4">
                <h3 className="text-xs font-heading font-bold text-foreground mb-2 flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                  Lihat Hasil
                </h3>
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">Klasifikasi ASLI atau PALSU instan dengan skor keyakinan dan heatmap.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-w-lg mx-auto">
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-2xl blur-lg opacity-60 group-hover:opacity-80 transition-opacity" />
              <div className="relative rounded-xl overflow-hidden border border-border bg-black shadow-lg">
                {mediaType === 'video' ? (
                  <video
                    src={mediaPreview}
                    controls
                    className="w-full h-auto max-h-[55vh]"
                  />
                ) : mediaType === 'file' ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileWarning className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm font-medium truncate max-w-full px-6">{mediaName}</p>
                    <p className="text-xs mt-1 opacity-60">Format tidak dapat ditampilkan sebagai pratinjau</p>
                  </div>
                ) : (
                  <>
                    <img
                      src={mediaPreview}
                      alt="Uploaded"
                      className="w-full h-auto max-h-[55vh] object-contain"
                    />
                    {scanning && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent shadow-[0_0_12px_theme(colors.primary/0.6)] animate-[scanner-line_2.5s_ease-in-out_infinite]" />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 backdrop-blur-sm px-4 py-2 text-sm text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:border-accent/30 shadow-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Ganti File
              </button>
            </div>

            <div ref={analyzeRef}>
              <AnalysisPanel key={resetKey} mediaDataUrl={mediaPreview} mediaType={mediaType!} mediaName={mediaName} onScanningChange={setScanning} />
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
