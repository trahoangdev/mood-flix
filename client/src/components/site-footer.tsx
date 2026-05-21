import { Heart } from "lucide-react"
import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t-2 bg-background">
      <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>Made with</span>
            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
            <span>by</span>
            <Link
              href="https://github.com/trahoangdev"
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              trahoangdev
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            MUGVN x MongoDB Mini Hackathon 2026 recommendation engine demo.
          </p>
        </div>
      </div>
    </footer>
  )
}
