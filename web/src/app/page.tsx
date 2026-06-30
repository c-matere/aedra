"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

// Asterisk-like sparkle glyph in a warm orange/amber brand tone
const LogoMark = () => (
  <svg className="w-6 h-6 text-[#d96b27] mr-2 shrink-0 animate-[pulse_3s_infinite_ease-in-out]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="22"></line>
    <line x1="2" y1="12" x2="22" y2="12"></line>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
    <line x1="4.93" y1="19.07" x2="19.07" y2="4.93"></line>
  </svg>
)

// Decorative simple line-art icons for plans
const TreeIcon1 = () => (
  <svg className="w-12 h-12 text-[#1f1e1d] mb-4 stroke-[1.25]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M8 12h8M9 8h6M10 16h4" />
  </svg>
)

const TreeIcon2 = () => (
  <svg className="w-12 h-12 text-[#1f1e1d] mb-4 stroke-[1.25]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M12 6c-3 0-5 2-5 5h10c0-3-2-5-5-5zM12 11c-4 0-6 2.5-6 6h12c0-3.5-2-6-6-6z" />
  </svg>
)

const TreeIcon3 = () => (
  <svg className="w-12 h-12 text-[#1f1e1d] mb-4 stroke-[1.25]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M12 5c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7zM12 9c-2 0-3.5 1.5-3.5 3.5s1.5 3.5 3.5 3.5 3.5-1.5 3.5-3.5S14 9 12 9z" />
  </svg>
)

// Simple checkmark icon
const Checkmark = () => (
  <svg className="w-4 h-4 text-[#141413] stroke-[2] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
)

export default function Home() {
  const [demoActiveTab, setDemoActiveTab] = useState<"chat" | "coworker">("chat")
  const [email, setEmail] = useState("")

  return (
    <div className="flex min-h-screen flex-col bg-[#faf9f5] text-[#141413] font-sans antialiased">
      {/* Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-20 items-center justify-between px-6 md:px-12 bg-[#faf9f5] border-none max-w-[1200px] mx-auto w-full">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <LogoMark />
          <span className="font-serif font-normal text-2xl tracking-tight text-[#141413]">Aedra</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-[#1f1e1d]">
          <Link href="#features" className="hover:text-[#141413] transition-colors">Platform</Link>
          <Link href="#solutions" className="hover:text-[#141413] transition-colors">Solutions</Link>
          <Link href="#pricing" className="hover:text-[#141413] transition-colors">Pricing</Link>
          <Link href="#about" className="hover:text-[#141413] transition-colors">About</Link>
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-[#1f1e1d] hover:bg-[#f0eee6] font-medium text-[15px] border border-[#dedcd1]">
              Contact Sales
            </Button>
          </Link>
          <Link href="/login">
            <Button className="bg-primary text-primary-foreground hover:opacity-90 font-medium text-[15px] px-[20px] py-[8px]">
              Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-[1200px] mx-auto w-full pt-[120px] pb-16 px-6 md:px-12 flex flex-col gap-[64px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Serif Display Headline & Auth Form Card */}
          <div className="flex flex-col">
            <h1 className="font-serif text-[48px] md:text-[56px] font-light leading-[1.2] text-[#141413] mb-8 tracking-tight">
              Manage your properties with <span className="italic text-[#d96b27]">crystal clarity</span>.
            </h1>
            
            {/* Auth Form Card */}
            <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-8 shadow-none flex flex-col w-full max-w-[440px]">
              {/* Social Auth Button */}
              <button className="flex items-center justify-center gap-3 w-full h-[44px] bg-[#ffffff] border border-[#dedcd1] rounded-[9.6px] text-[#1f1e1d] font-medium text-[15px] hover:border-[#1f1e1d] transition-all duration-200">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.62-.06-1.21-.37-1.69-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="h-[1px] flex-1 bg-[#dedcd1]" />
                <span className="text-[12px] text-[#73726c] font-medium uppercase tracking-wider">or</span>
                <div className="h-[1px] flex-1 bg-[#dedcd1]" />
              </div>

              {/* Email Input & Primary Button stacked */}
              <div className="flex flex-col gap-3">
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[44px] bg-[#ffffff] border border-[#dedcd1] rounded-[9.6px] px-4 text-[#141413] text-[15px] placeholder-[#73726c] focus:border-[#1f1e1d] focus:outline-none transition-all duration-200"
                />
                
                <Link href={`/register?email=${encodeURIComponent(email)}`} className="w-full">
                  <Button className="w-full h-[44px] bg-primary text-primary-foreground hover:opacity-90 font-medium text-[15px] rounded-[9.6px]">
                    Continue with Email
                  </Button>
                </Link>
              </div>

              <span className="text-[12px] text-[#73726c] mt-4 text-center leading-relaxed">
                By continuing, you agree to Aedra's{" "}
                <Link href="#" className="underline hover:text-[#141413]">Terms of Service</Link> and{" "}
                <Link href="#" className="underline hover:text-[#141413]">Privacy Policy</Link>.
              </span>
            </div>
          </div>

          {/* Right Column: Interactive Demo Panel */}
          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-[500px] bg-[#faf9f5] border border-[#dedcd1] rounded-[32px] p-6 relative overflow-hidden">
              <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[24px] p-6 flex flex-col gap-4 relative min-h-[380px]">
                
                {/* Segmented control for tabs */}
                <div className="flex bg-[#f0eee6] rounded-[9.6px] p-1 self-start w-fit">
                  <button
                    onClick={() => setDemoActiveTab("chat")}
                    className={`px-4 py-1.5 rounded-[9.6px] text-xs font-medium transition-all duration-200 ${
                      demoActiveTab === "chat"
                        ? "bg-[#ffffff] border border-[#dedcd1] text-[#141413]"
                        : "text-[#73726c] border border-transparent hover:text-[#141413]"
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setDemoActiveTab("coworker")}
                    className={`px-4 py-1.5 rounded-[9.6px] text-xs font-medium transition-all duration-200 ${
                      demoActiveTab === "coworker"
                        ? "bg-[#ffffff] border border-[#dedcd1] text-[#141413]"
                        : "text-[#73726c] border border-transparent hover:text-[#141413]"
                    }`}
                  >
                    Co-worker
                  </button>
                </div>

                {/* Chat simulated interface */}
                <div className="flex-1 flex flex-col justify-end gap-4 font-sans text-[14px]">
                  {demoActiveTab === "chat" ? (
                    <>
                      <div className="flex flex-col items-start gap-1 max-w-[85%] self-start">
                        <span className="text-[11px] text-[#73726c] font-medium">Aedra Agent</span>
                        <div className="bg-[#f0eee6] border border-[#dedcd1] rounded-[16px] rounded-tl-[4px] px-4 py-3 text-[#141413] leading-relaxed">
                          I've analyzed the lease agreement for <b>Unit 4B</b>. The rent escalation is set to 5% annually, starting Oct 1st.
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 max-w-[85%] self-end">
                        <span className="text-[11px] text-[#73726c] font-medium">You</span>
                        <div className="bg-[#1f1e1d] text-true-white rounded-[16px] rounded-tr-[4px] px-4 py-3 leading-relaxed">
                          Great, draft the tenant notification email.
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1 max-w-[85%] self-start animate-fade-in">
                        <span className="text-[11px] text-[#73726c] font-medium">Aedra Agent</span>
                        <div className="bg-[#f0eee6] border border-[#dedcd1] rounded-[16px] rounded-tl-[4px] px-4 py-3 text-[#141413] leading-relaxed">
                          Notification drafted. Rent will adjust to KES 84,000. Would you like me to schedule it?
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-start gap-1 max-w-[85%] self-start">
                        <span className="text-[11px] text-[#73726c] font-medium">System Co-worker</span>
                        <div className="bg-[#f0eee6] border border-[#dedcd1] rounded-[16px] rounded-tl-[4px] px-4 py-3 text-[#141413] leading-relaxed">
                          Aedra Co-worker is listening for triggers. Background lease audits run automatically.
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1 max-w-[85%] self-start">
                        <span className="text-[11px] text-[#73726c] font-medium">System Co-worker</span>
                        <div className="bg-[#f0eee6] border border-[#dedcd1] rounded-[16px] rounded-tl-[4px] px-4 py-3 text-[#141413] leading-relaxed">
                          ✅ Verified 18 tenant statements today. 2 escalation letters queued.
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Simulated Input Field */}
                <div className="flex items-center gap-2 mt-2 pt-3 border-t border-[#dedcd1]">
                  <div className="flex-1 bg-[#f0eee6] h-9 rounded-[9.6px] px-3 flex items-center text-[#73726c] text-xs">
                    Type a message or task...
                  </div>
                  <div className="w-9 h-9 rounded-[9.6px] bg-[#1f1e1d] flex items-center justify-center text-true-white cursor-pointer hover:opacity-90">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </div>
                </div>

                {/* Decorative Cursor pointing at Chat Tab */}
                <div className="absolute top-[48px] right-[40%] pointer-events-none transform translate-y-3 translate-x-3 opacity-90 transition-transform duration-700 animate-bounce">
                  <svg className="w-6 h-6 text-[#141413] drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.5 3v15.2l4.8-4.6 4.2 8.4 2.8-1.4-4.2-8.4h6.4L4.5 3z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generous Section Break */}
        <div className="h-px bg-[#dedcd1] w-full" id="pricing" />

        {/* Pricing Card Grid Section */}
        <div className="flex flex-col items-center py-8">
          <div className="text-center max-w-[600px] mb-16">
            <h2 className="font-serif text-[30px] font-normal text-[#141413] mb-4">
              Simple, editorial pricing plans.
            </h2>
            <p className="text-[15px] text-[#73726c] leading-relaxed">
              No hidden platform fees. Choose a plan crafted for your estate size, and begin automated property management today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-[1100px]">
            {/* Plan 1: Starter */}
            <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-8 shadow-none flex flex-col justify-between min-h-[460px]">
              <div>
                <TreeIcon1 />
                <h3 className="font-serif font-normal text-2xl text-[#141413] mb-2">Starter</h3>
                <p className="text-[13px] text-[#73726c] mb-6">Perfect for individual landlords managing up to 10 units.</p>
                <div className="font-serif text-[30px] font-normal text-[#141413] mb-6">
                  KES 4,900<span className="text-[14px] text-[#73726c] font-sans">/mo</span>
                </div>
                
                <div className="h-[1px] bg-[#dedcd1] my-6" />

                <ul className="flex flex-col gap-4">
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Manage up to 10 units</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>WhatsApp OTP log-ins</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Basic lease tracking & audits</span>
                  </li>
                </ul>
              </div>
              <Link href="/register?plan=starter" className="mt-8">
                <Button className="w-full bg-primary text-primary-foreground hover:opacity-90">
                  Select Starter
                </Button>
              </Link>
            </div>

            {/* Plan 2: Professional */}
            <div className="bg-[#ffffff] border-2 border-[#1f1e1d] rounded-[16px] p-8 shadow-none flex flex-col justify-between min-h-[460px] relative">
              <div className="absolute top-4 right-4 bg-[#ccdbe8] text-[#141413] px-2.5 py-0.5 rounded-[9.6px] text-[10px] font-semibold tracking-wider uppercase">
                Popular
              </div>
              <div>
                <TreeIcon2 />
                <h3 className="font-serif font-normal text-2xl text-[#141413] mb-2">Professional</h3>
                <p className="text-[13px] text-[#73726c] mb-6">Ideal for growing property firms with up to 100 units.</p>
                <div className="font-serif text-[30px] font-normal text-[#141413] mb-6">
                  KES 14,900<span className="text-[14px] text-[#73726c] font-sans">/mo</span>
                </div>

                <div className="h-[1px] bg-[#dedcd1] my-6" />

                <ul className="flex flex-col gap-4">
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Manage up to 100 units</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>AI Property Co-worker active</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>WhatsApp tenant notifications</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Custom lease template editor</span>
                  </li>
                </ul>
              </div>
              <Link href="/register?plan=pro" className="mt-8">
                <Button className="w-full bg-primary text-primary-foreground hover:opacity-90">
                  Select Professional
                </Button>
              </Link>
            </div>

            {/* Plan 3: Enterprise */}
            <div className="bg-[#ffffff] border border-[#dedcd1] rounded-[16px] p-8 shadow-none flex flex-col justify-between min-h-[460px]">
              <div>
                <TreeIcon3 />
                <h3 className="font-serif font-normal text-2xl text-[#141413] mb-2">Enterprise</h3>
                <p className="text-[13px] text-[#73726c] mb-6">For large estates, malls, and property portfolios.</p>
                <div className="font-serif text-[30px] font-normal text-[#141413] mb-6">
                  Custom Pricing
                </div>

                <div className="h-[1px] bg-[#dedcd1] my-6" />

                <ul className="flex flex-col gap-4">
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Unlimited units & buildings</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Dedicated AI model finetuning</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>Role-based access controls (RBAC)</span>
                  </li>
                  <li className="flex items-start gap-3 text-[14px] text-[#1f1e1d]">
                    <Checkmark />
                    <span>24/7 Priority VIP support</span>
                  </li>
                </ul>
              </div>
              <Link href="/login" className="mt-8">
                <Button variant="ghost" className="w-full text-[#1f1e1d] hover:bg-[#f0eee6] border border-[#dedcd1]">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#f0eee6] border-t border-[#dedcd1] py-12 px-6 md:px-12 mt-auto">
        <div className="max-w-[1200px] mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center">
            <LogoMark />
            <span className="font-serif font-normal text-xl text-[#141413]">Aedra</span>
          </div>
          <div className="text-[12px] text-[#73726c] text-center md:text-right">
            <p>© 2026 Aedra. Warm letterpress on cream. Crafted with care in Mombasa.</p>
            <p className="mt-1">Powered by Advanced Agentic Coding.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
