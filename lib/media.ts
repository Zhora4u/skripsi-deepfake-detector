export function isVideoDataUrl(url: string): boolean {
  if (!url) return false
  return url.startsWith('data:video/') || /\.(mp4|webm|mov|avi)(\?|#|$)/i.test(url)
}

function dataUrlToBlobUrl(dataUrl: string): string {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'video/mp4'
  const raw = atob(parts[1])
  const len = raw.length
  const buf = new Uint8Array(len)
  for (let i = 0; i < len; i++) buf[i] = raw.charCodeAt(i)
  const blob = new Blob([buf], { type: mime })
  return URL.createObjectURL(blob)
}

function extractFrameAt(
  video: HTMLVideoElement,
  seekTime: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const handler = () => {
      try {
        const w = video.videoWidth || 640
        const h = video.videoHeight || 480
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        requestAnimationFrame(() => {
          ctx.drawImage(video, 0, 0, w, h)
          resolve(canvas.toDataURL('image/png'))
        })
      } catch { resolve(null) }
    }
    video.onseeked = handler
    if (!video.seeking) video.currentTime = seekTime
  })
}

export function extractVideoFrame(
  src: string,
  seekTime = 0.3,
  timeoutMs = 15000,
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false
    let blobUrl: string | null = null

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'

    const cleanup = () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
        blobUrl = null
      }
    }

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(null)
      }
    }, timeoutMs)

    video.onloadedmetadata = () => {
      if (!video.seeking) video.currentTime = seekTime
    }

    video.onseeked = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      extractFrameAt(video, seekTime).then((dataUrl) => {
        cleanup()
        resolve(dataUrl)
      })
    }

    video.onerror = () => {
      if (!resolved) {
        video.currentTime = 0.1
        video.onseeked = () => {
          if (resolved) return
          resolved = true
          clearTimeout(timeout)
          extractFrameAt(video, 0.1).then((dataUrl) => {
            cleanup()
            resolve(dataUrl)
          })
        }
      }
    }

    if (src.startsWith('data:video/')) {
      blobUrl = dataUrlToBlobUrl(src)
      video.src = blobUrl
    } else {
      video.src = src
    }
    video.load()
  })
}

export async function extractMultipleVideoFrames(
  src: string,
  timestamps: number[],
  timeoutMs = 30000,
): Promise<(string | null)[]> {
  let blobUrl: string | null = null

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const cleanup = () => {
    video.pause()
    video.removeAttribute('src')
    video.load()
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl)
      blobUrl = null
    }
  }

  if (src.startsWith('data:video/')) {
    blobUrl = dataUrlToBlobUrl(src)
    video.src = blobUrl
  } else {
    video.src = src
  }

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Video load timeout')), timeoutMs)
    video.onloadedmetadata = () => { clearTimeout(t); resolve() }
    video.onerror = () => { clearTimeout(t); reject(new Error('Video load failed')) }
    video.load()
  })

  const results: (string | null)[] = []
  for (const t of timestamps) {
    const frame = await extractFrameAt(video, Math.min(t, video.duration || t))
    results.push(frame)
  }

  cleanup()
  return results
}
