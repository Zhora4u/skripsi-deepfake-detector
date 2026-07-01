'use client'

import { Shield } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="border-t border-border/30 bg-gradient-to-b from-card/60 to-card/30 backdrop-blur-sm mt-12">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-bold tracking-wider text-foreground/80 uppercase">DeepFake Detector</span>
          </div>
          <p className="text-[10px] text-muted-foreground/35 tracking-wide">
            &copy; {new Date().getFullYear()} &mdash; DeepFake Detector
          </p>
        </div>
      </div>
    </footer>
  )
}
