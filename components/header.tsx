'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b border-border/40 bg-card/80 backdrop-blur-lg">
      <div className="container mx-auto px-4 py-3.5">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-2 shadow-sm shadow-primary/20 transition-transform group-hover:scale-105">
              <svg width="22" height="22" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M90 30L135 50V95C135 125 115 150 90 160C65 150 45 125 45 95V50L90 30Z" fill="currentColor" className="text-primary-foreground" />
                <path d="M75 95L85 108L108 75" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none" className="text-[#c9a84c] opacity-90" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">DeepFake Detector</h1>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">Deteksi Deepfake Berbasis AI</p>
            </div>
          </Link>
        </div>
      </div>
    </header>
  )
}
