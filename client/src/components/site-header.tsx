import { Clapperboard } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b-2 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-[1200px] items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3 font-semibold">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-[24px] border-2 border-foreground bg-primary text-primary-foreground">
            <Clapperboard className="size-4" />
          </span>
          <span className="font-display truncate text-3xl tracking-[0.02em] uppercase">
            MoodFlix
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="http://localhost:4000/api/system/readiness"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              API Status
            </a>
          </Button>
          <Button variant="ghost" asChild size="sm" className="hidden sm:flex">
            <a
              href="https://mini-hackathon-2026.mugvn.com/"
              rel="noopener noreferrer"
              target="_blank"
              className="dark:text-foreground"
            >
              Hackathon
            </a>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
