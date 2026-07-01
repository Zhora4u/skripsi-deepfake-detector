'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield, Info, Video, Loader2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { extractMultipleVideoFrames } from '@/lib/media'

interface RegionImportance {
  name: string
  importance: number
}

interface MLResult {
  prediction: 'REAL' | 'FAKE'
  confidence: number
  raw_score?: number
  heatmap?: string
  regions?: RegionImportance[]
  elapsed?: number
}

interface MLFrameResult {
  prediction: 'REAL' | 'FAKE'
  confidence: number
}

interface AnalysisPanelProps {
  mediaDataUrl: string
  mediaType: 'image' | 'video' | 'file'
  mediaName?: string
  onScanningChange?: (scanning: boolean) => void
}

export default function AnalysisPanel({ mediaDataUrl, mediaType, mediaName, onScanningChange }: AnalysisPanelProps) {
  const [mlResult, setMlResult] = useState<MLResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string>('')
  const [frameResults, setFrameResults] = useState<MLFrameResult[]>([])
  const [frameCount, setFrameCount] = useState(0)
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmapError, setHeatmapError] = useState<string | null>(null)
  const [feedbackGiven, setFeedbackGiven] = useState(false)
  const [feedbackSaving, setFeedbackSaving] = useState(false)
  const cancelledRef = useRef(false)

  const sendToApi = useCallback(async (dataUrl: string, save?: boolean): Promise<MLResult> => {
    const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5001'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)
    try {
      const res = await fetch(`${FLASK_URL}/predict`, {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl, save_history: save ?? false, filename: mediaName || null }),
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (!res.ok) {
        const apiErr: any = new Error(data.error || `API Error: ${res.status}`)
        apiErr.status = res.status
        throw apiErr
      }
      return data as MLResult
    } catch (err) {
      clearTimeout(timeoutId)
      throw err
    }
  }, [])

  const sendFeedback = useCallback(async (correct: boolean) => {
    setFeedbackSaving(true)
    const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5001'
    try {
      await fetch(`${FLASK_URL}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          correct,
          filename: mediaName || null,
          prediction: mlResult?.prediction,
          confidence: mlResult?.confidence,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      setFeedbackGiven(true)
    } catch {
      // silent — don't block user
    } finally {
      setFeedbackSaving(false)
    }
  }, [mediaName, mlResult])

  const fetchExplanation = useCallback(async (dataUrl: string): Promise<MLResult | null> => {
    const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5001'
    try {
      const res = await fetch(`${FLASK_URL}/explain`, {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data as MLResult
    } catch {
      return null
    }
  }, [])

  const handleAnalyze = async () => {
    console.log('[Analyze] clicked, mediaType:', mediaType, 'dataUrl length:', mediaDataUrl?.length)
    if (cancelledRef.current) return
    setLoading(true)
    onScanningChange?.(true)
    setError(null)
    setMlResult(null)
    setFrameResults([])
    setFeedbackGiven(false)
    setHeatmapError(null)
    setStatusText('Mengirim data ke server...')

    if (mediaType === 'file') {
      setError('File ini bukan gambar atau video. Silakan pilih file gambar (JPG, PNG, WebP, BMP, GIF) atau video.')
      onScanningChange?.(false)
      setLoading(false)
      setStatusText('')
      return
    }

    if (mediaType === 'image') {
      try {
        setStatusText('Menganalisis...')
        const data = await sendToApi(mediaDataUrl)
        if (!cancelledRef.current) {
          setMlResult(data)
          setStatusText('')

          setHeatmapLoading(true)
          setHeatmapError(null)
          fetchExplanation(mediaDataUrl).then((explainResult) => {
            if (!cancelledRef.current && explainResult) {
              setHeatmapUrl(explainResult.heatmap || null)
              setMlResult((prev) => prev ? { ...prev, heatmap: explainResult.heatmap, regions: explainResult.regions } : prev)
              setHeatmapLoading(false)
            } else if (!cancelledRef.current) {
              setHeatmapError('Gagal memuat visualisasi Grad-CAM. Periksa server API.')
              setHeatmapLoading(false)
            }
          })
        }
      } catch (err) {
        const isValidationError = (err as any)?.status >= 400 && (err as any)?.status < 500
        if (!isValidationError) console.error('[Analyze Error]', err)
        if (!cancelledRef.current) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            setError('Request timed out — server tidak merespon dalam 60 detik')
          } else {
            setError(err instanceof Error ? err.message : 'Koneksi ke server ML gagal')
          }
        }
      } finally {
        if (!cancelledRef.current) {
          onScanningChange?.(false)
          setLoading(false)
          setStatusText('')
        }
      }
    } else {
      try {
        setStatusText('Mengekstrak frame video...')
        const timestamps = [0.2, 0.4, 0.6, 0.8]
        const frames = await extractMultipleVideoFrames(mediaDataUrl, timestamps)
        const validFrames = frames.filter((f): f is string => f !== null)

        if (validFrames.length === 0) {
          setError('Gagal mengekstrak frame dari video')
          onScanningChange?.(false)
          setLoading(false)
          setStatusText('')
          return
        }

        setFrameCount(validFrames.length)
        setStatusText(`Menganalisis ${validFrames.length} frame video...`)

        const results = await Promise.allSettled(validFrames.map((f) => sendToApi(f, false)))
        const fulfilled = results.filter((r): r is PromiseFulfilledResult<MLResult> => r.status === 'fulfilled')

        if (fulfilled.length === 0) {
          setError('Semua prediksi frame gagal')
          onScanningChange?.(false)
          setLoading(false)
          setStatusText('')
          return
        }

        const framePreds: MLFrameResult[] = fulfilled.map((r) => ({
          prediction: r.value.prediction,
          confidence: r.value.confidence,
        }))
        setFrameResults(framePreds)

        const scores = fulfilled.map((r) =>
          r.value.prediction === 'FAKE' ? 1 - r.value.confidence : r.value.confidence
        )
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
        const avgConfidence = Math.round(
          (avgScore > 0.5 ? avgScore : 1 - avgScore) * 100
        ) / 100

        setMlResult({
          prediction: avgScore > 0.5 ? 'REAL' : 'FAKE',
          confidence: avgConfidence,
        })
        setStatusText('')
      } catch (err) {
        console.error('[Analysis Error]', err)
        if (!cancelledRef.current) {
          setError(`Gagal: ${err instanceof Error ? err.message : 'Kesalahan analisis'}`)
        }
      } finally {
        if (!cancelledRef.current) {
          onScanningChange?.(false)
          setLoading(false)
          setStatusText('')
        }
      }
    }
  }

  useEffect(() => {
    cancelledRef.current = false
    return () => { cancelledRef.current = true }
  }, [])

  const isFake = mlResult?.prediction === 'FAKE'
  const confidencePct = mlResult ? Math.min(100, Math.max(0, mlResult.confidence * 100)) : 0
  const minConf = frameResults.length > 0
    ? Math.min(...frameResults.map((r) => r.confidence)) * 100
    : 0
  const maxConf = frameResults.length > 0
    ? Math.max(...frameResults.map((r) => r.confidence)) * 100
    : 0

  const topRegions = mlResult?.regions?.slice(0, 3) ?? []
  const top1 = topRegions[0]
  const top2 = topRegions[1]

  const explanationText = (() => {
    if (!mlResult?.regions || topRegions.length === 0) return null
    if (isFake) {
      if (top1 && top2) {
        return `Wajah ini terdeteksi sebagai PALSU. Model mendeteksi artefak deepfake yang kuat pada ${top1.name} (pengaruh ${(top1.importance * 100).toFixed(0)}%) dan ${top2.name} (pengaruh ${(top2.importance * 100).toFixed(0)}%). Area ini menunjukkan pola yang tidak konsisten dengan fitur wajah alami.`
      }
      if (top1) {
        return `Wajah ini terdeteksi sebagai PALSU. ${top1.name} (pengaruh ${(top1.importance * 100).toFixed(0)}%) menunjukkan artefak deepfake terkuat, yang merupakan indikator umum wajah hasil AI atau manipulasi.`
      }
      return null
    }
    if (confidencePct < 80 && top1) {
      return `Wajah ini terdeteksi sebagai ASLI, namun dengan keyakinan yang relatif rendah (${confidencePct.toFixed(0)}%). ${top1.name} menunjukkan pola yang agak atipikal, meskipun tidak cukup untuk diklasifikasikan sebagai PALSU.`
    }
    return 'Wajah ini terdeteksi sebagai ASLI. Model tidak menemukan artefak deepfake yang signifikan. Seluruh area wajah menunjukkan pola yang konsisten dengan gambar asli.'
  })()

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          {mediaType === 'video' ? (
            <Video className="h-4 w-4 text-primary" />
          ) : (
            <Shield className="h-4 w-4 text-primary" />
          )}
          Hasil Deteksi
        </h2>

        {mediaType === 'video' && !mlResult && !loading && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 mb-4 text-xs text-blue-700 dark:text-blue-300">
            Video akan dianalisis dengan mengekstrak beberapa frame kunci untuk deteksi menyeluruh.
          </div>
        )}
        {mediaType === 'file' && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 mb-4 text-xs text-rose-700 dark:text-rose-300">
            File ini bukan gambar atau video. Pilih file gambar (JPG, PNG, WebP, BMP, GIF) atau video.
          </div>
        )}

        <Button
          onClick={handleAnalyze}
          disabled={loading || mediaType === 'file' || !!mlResult}
          className="w-full rounded-lg"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Menganalisis...
            </span>
          ) : (
            "Analisis"
          )}
        </Button>

        {statusText && loading && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            {statusText}
          </div>
        )}

        {error && !loading && (
          <div className="mt-3 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {mlResult && !loading && (
        <div className={`rounded-xl border p-6 ${isFake ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
          <div className="flex flex-col items-center text-center">
            <div className={`text-3xl font-bold mb-2 ${isFake ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isFake ? 'PALSU' : 'ASLI'}
            </div>
            <div className="text-sm text-muted-foreground/70 mb-3">
              Tingkat Keyakinan &mdash; {confidencePct.toFixed(1)}%
            </div>
            <div className="w-full max-w-xs bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isFake ? 'bg-rose-400' : 'bg-emerald-400'}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">Model: XceptionNet</p>
          </div>

          {!feedbackGiven ? (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Apakah hasil ini benar?</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => sendFeedback(true)}
                  disabled={feedbackSaving}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs text-foreground transition-all hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50"
                >
                  👍 Benar
                </button>
                <button
                  onClick={() => sendFeedback(false)}
                  disabled={feedbackSaving}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs text-foreground transition-all hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50"
                >
                  👎 Salah
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-center text-emerald-600 font-medium">Terima kasih atas masukannya!</p>
          )}

          {frameResults.length > 1 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mt-4">
              <h4 className="text-xs font-semibold text-foreground mb-2">Analisis Multi-Frame</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Menganalisis {frameCount} frame dari video</p>
                <p>
                  Rentang confidence: {minConf.toFixed(1)}% – {maxConf.toFixed(1)}%
                </p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Grad-CAM Explanation */}
      {mlResult && !loading && mediaType === 'image' && heatmapLoading && (
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>Menghitung heatmap Grad-CAM...</p>
              <p className="text-[11px] text-muted-foreground/60">Menganalisis aktivasi model — estimasi 5-10 detik</p>
            </div>
            <div className="w-full max-w-xs bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}

      {mlResult && !loading && mediaType === 'image' && heatmapError && (
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <Eye className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground/60">{heatmapError}</p>
          </div>
        </div>
      )}

      {mlResult && !loading && mediaType === 'image' && heatmapUrl && (
        <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">Mengapa Hasil Ini?</span>
          </div>

          {explanationText && (
            <p className="text-sm leading-relaxed text-foreground/90">
              {explanationText}
            </p>
          )}

          <div className="relative overflow-hidden rounded-lg border border-border/60">
            <img
              src={heatmapUrl}
              alt="Heatmap Grad-CAM: area merah paling memengaruhi keputusan"
              className="w-full h-auto object-contain"
            />
          </div>

          {topRegions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Area yang paling berpengaruh:</p>
              <div className="space-y-1">
                {mlResult.regions!.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{r.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${r.importance * 100}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-8 text-right">
                        {(r.importance * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      <div className="rounded-xl bg-card/60 backdrop-blur-sm p-4 border border-border/80">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-primary" />
          Cara Deteksi Bekerja
        </h3>
        <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p><strong>1.</strong> File diproses oleh model deep learning yang dilatih pada ribuan gambar wajah asli dan palsu.</p>
          <p><strong>2.</strong> Untuk video, frame kunci diekstrak pada beberapa titik waktu untuk analisis menyeluruh.</p>
          <p><strong>3.</strong> Klasifikasi akhir ASLI atau PALSU dihasilkan dengan skor keyakinan.</p>
        </div>
      </div>

      <div className="rounded-xl bg-secondary/60 border border-border/60 p-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Catatan:</strong> Hasil ini hanya untuk referensi. Selalu kombinasikan dengan inspeksi manual untuk keputusan penting.
        </p>
      </div>

    </div>
  )
}
