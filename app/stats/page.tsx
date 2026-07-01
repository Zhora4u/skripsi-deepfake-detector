'use client'

import { useEffect, useState } from 'react'

interface FeedbackRow {
  id: number
  filename: string | null
  prediction: string
  confidence: number
  correct: boolean
  created_at: string
}

interface StatsData {
  total_predictions: number
  total_feedback: number
  total_correct: number
  total_incorrect: number
  feedback: FeedbackRow[]
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || '/api'
    fetch(`${FLASK_URL}/feedback-stats`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Gagal memuat statistik'))
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-destructive relative">
        <div className="fixed inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/15" />
        <div className="relative bg-card/80 backdrop-blur-sm rounded-xl border border-border/60 px-6 py-4">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground relative">
        <div className="fixed inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/15" />
        <span className="relative">Memuat...</span>
      </div>
    )
  }

  const accuracy = data.total_feedback > 0
    ? ((data.total_correct / data.total_feedback) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/15 via-background to-accent/15" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent" />
      <div className="relative mx-auto max-w-4xl space-y-8 px-4 py-12">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-heading font-bold text-foreground tracking-tight">Statistik Feedback</h1>
          <p className="text-sm text-muted-foreground/70">Ringkasan data prediksi dan umpan balik pengguna</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{data.total_predictions}</p>
            <p className="text-xs text-muted-foreground/70 mt-1 tracking-wide uppercase">Total Prediksi</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{data.total_feedback}</p>
            <p className="text-xs text-muted-foreground/70 mt-1 tracking-wide uppercase">Total Umpan Balik</p>
          </div>
          <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/40 backdrop-blur-sm p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{data.total_correct}</p>
            <p className="text-xs text-emerald-600/70 mt-1 tracking-wide uppercase">Benar</p>
          </div>
          <div className="rounded-xl border border-rose-200/50 bg-rose-50/40 backdrop-blur-sm p-4 text-center">
            <p className="text-2xl font-bold text-rose-600">{data.total_incorrect}</p>
            <p className="text-xs text-rose-600/70 mt-1 tracking-wide uppercase">Salah</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{accuracy}%</p>
            <p className="text-xs text-muted-foreground/70 mt-1 tracking-wide uppercase">Akurasi</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-left p-3 font-semibold text-muted-foreground/80 tracking-wide uppercase">No</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground/80 tracking-wide uppercase">File</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground/80 tracking-wide uppercase">Prediksi</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground/80 tracking-wide uppercase">Keyakinan</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground/80 tracking-wide uppercase">Umpan Balik</th>
                  <th className="text-left p-3 font-semibold text-muted-foreground/80 tracking-wide uppercase">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {data.feedback.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground/60">
                      Belum ada umpan balik
                    </td>
                  </tr>
                ) : (
                  data.feedback.map((row, i) => (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-muted/15 transition-colors">
                      <td className="p-3 text-muted-foreground/70">{i + 1}</td>
                      <td className="p-3 text-foreground">{row.filename || '-'}</td>
                      <td className="p-3">
                        <span className={row.prediction === 'FAKE' ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                          {row.prediction}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground/70">{(row.confidence * 100).toFixed(1)}%</td>
                      <td className="p-3">
                        <span className={row.correct ? 'text-emerald-600' : 'text-rose-600'}>
                          {row.correct ? 'Benar' : 'Salah'}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground/70">{row.created_at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
