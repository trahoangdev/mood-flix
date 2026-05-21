import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { MoodflixDashboard } from "@/features/moodflix/moodflix-dashboard"

export default function HomePage() {
  return (
    <div className="caldera-shell flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-4 py-6 lg:px-6">
          <MoodflixDashboard />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
