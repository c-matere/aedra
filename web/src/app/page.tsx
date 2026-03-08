"use client"

import Link from "next/link"
import { Building2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-50 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center border-b border-white/10 bg-neutral-950 px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 shadow-inner">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Aedra
          </span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:bg-white/10">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button variant="glass" className="bg-white/20 text-white hover:bg-white/30 border-white/40">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-32 pb-20 z-10">

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-neutral-900 mb-8">
          <span className="flex h-2 w-2 rounded-full bg-white" />
          <span className="text-sm font-medium text-neutral-300">Modern Property Management for Mombasa</span>
        </div>

        <h1 className="max-w-4xl text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
          Manage your properties with{" "}
          <span className="text-white inline-block">
            crystal clarity.
          </span>
        </h1>

        <p className="max-w-2xl text-lg md:text-xl text-neutral-400 mb-10 leading-relaxed">
          Aedra provides property managers and landlords with a beautiful, automated, and secure platform to handle leases, track payments, and resolve maintenance tickets.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link href="/login" className="w-full">
            <Button size="lg" className="w-full text-base font-semibold bg-white text-black hover:bg-neutral-200 shadow-[0_0_30px_rgba(255,255,255,0.3)]">
              Enter Platform <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="#features" className="w-full">
            <Button size="lg" variant="glass" className="w-full text-base font-semibold border-white/20">
              View Features
            </Button>
          </Link>
        </div>

        {/* Hero Mockup Graphic */}
        <div className="mt-20 w-full max-w-5xl rounded-2xl border border-white/10 bg-neutral-900 p-2 shadow-lg relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent rounded-2xl z-10 pointer-events-none flex items-end justify-center pb-8">
            <div className="px-6 py-3 rounded-full bg-neutral-800 border border-white/10 text-sm text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Multi-Tenant Architecture
            </div>
          </div>
          <div className="aspect-video w-full rounded-xl bg-neutral-900 border border-white/10 overflow-hidden relative flex items-center justify-center group">
            <Building2 className="h-32 w-32 text-white/5 group-hover:text-white/10 transition-colors" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/10 to-transparent" />
          </div>
        </div>

      </main>
    </div>
  )
}
