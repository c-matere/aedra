"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import AetherFlowHero from "@/components/ui/aether-flow-hero"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-50 relative overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center border-b border-white/10 bg-neutral-950/80 backdrop-blur-md px-6 md:px-12">
        <div className="flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer">
          <img src="/aedra logo.png" alt="Aedra" className="h-10 w-auto" />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:bg-white/10">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center pt-[80px]">
        <AetherFlowHero />
      </main>
    </div>
  )
}
