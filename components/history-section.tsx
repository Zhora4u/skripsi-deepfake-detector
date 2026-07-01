'use client'

import { useState, useEffect } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface HistoryRow {
  id: number
  filename: string
  prediction: string
  confidence: number
  raw_score: number
  image_size: number
  created_at: string
}

export default function HistorySection() {
  const [data, setData] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5001'
    setLoading(true)
    setError(null)
    fetch(`${FLASK_URL}/history`)
      .then((res) => {
        if (!res.ok) throw new Error('Gagal memuat riwayat')
        return res.json()
      })
      .then((rows: HistoryRow[]) => {
        setData(rows)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const handleDownload = () => {
    const FLASK_URL = process.env.NEXT_PUBLIC_FLASK_API_URL || 'http://localhost:5001'
    window.open(`${FLASK_URL}/history/download`, '_blank')
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card/80 backdrop-blur-sm p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Riwayat Deteksi</h3>
        {data.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 gap-1.5 text-xs">
            <Download className="h-3 w-3" />
            Download CSV
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-xs">Memuat...</span>
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-rose-600 py-4 text-center">{error}</p>
      )}

      {!loading && !error && data.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center">Belum ada riwayat</p>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">No</TableHead>
                <TableHead className="text-xs">Nama File</TableHead>
                <TableHead className="text-xs">Hasil</TableHead>
                <TableHead className="text-xs">Keyakinan</TableHead>
                <TableHead className="text-xs">Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate" title={row.filename}>
                    {row.filename}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 font-medium ${
                        row.prediction === 'FAKE'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}
                    >
                      {row.prediction}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{(row.confidence * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
