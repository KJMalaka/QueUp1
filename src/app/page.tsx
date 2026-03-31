
"use client"

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/navbar';
import { SplashScreen } from '@/components/splash-screen';
import { Button } from '@/components/ui/button';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Bot, Sparkles } from 'lucide-react';

const departments = [
  { name: 'Home Affairs', image: '/images/home affairs.jpg' },
  { name: 'SASSA', image: '/images/sassa.jpeg' },
  { name: 'SARS', image: '/images/sars.jpg' },
  { name: 'Groote Schuur Hospital', image: '/images/hospital.jpg' },
  { name: 'Tygerberg Hospital', image: '/images/hospital.jpg' },
  { name: "Mitchell's Plain Hospital", image: '/images/hospital.jpg' },
  { name: 'Cape Town Magistrate', image: '/images/court.jpg' },
  { name: 'DLTC Milnerton', image: '/images/transport.jpeg' },
  { name: 'DLTC Parow', image: '/images/transport.jpeg' },
  { name: 'Cape Town Municipality', image: '/images/municipality.png' },
  { name: 'Dept of Labour', image: '/images/labour.jpg' },
];

export default function Home() {
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-bg');

  return (
    <main className="min-h-screen bg-background">
      <SplashScreen />
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen w-full flex flex-col items-center justify-center text-center px-6 pt-16">
        {/* Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {heroImage?.imageUrl ? (
            <Image
              src={heroImage.imageUrl}
              alt="South African Government Building"
              fill
              className="object-cover opacity-30 blur-sm"
              priority
              sizes="100vw"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(196,241,53,0.12),transparent)]" />
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}
              />
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/50 to-background" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-7 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {/* Live pill */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
            </span>
            Live across Cape Town
          </div>

          <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] font-headline font-extrabold tracking-tight leading-[1.0] text-foreground">
            Your queue.<br />
            <span className="text-primary">Without the wait.</span>
          </h1>

          <p className="text-base sm:text-lg font-body text-foreground/70 max-w-lg mx-auto leading-relaxed">
            Join any government queue from anywhere. We&apos;ll notify you when it&apos;s your turn — no more wasted hours.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto h-13 px-8 text-base font-bold rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all shadow-lg shadow-primary/20">
              <Link href="/join/flow">Join a Queue</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto h-13 px-8 text-base font-bold rounded-full border-foreground/20 hover:border-primary/50 hover:bg-foreground/5 transition-all">
              <Link href="/auth/signup">Create Account</Link>
            </Button>
          </div>

          {/* Ask Q CTA */}
          <Link
            href="/consultant"
            className="inline-flex items-center gap-2.5 rounded-full border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-bold text-primary transition-all hover:bg-primary/20 hover:border-primary/70 hover:scale-105 shadow-sm shadow-primary/10"
          >
            <Bot className="h-4 w-4" />
            Ask Q
            <Sparkles className="h-3.5 w-3.5 opacity-70" />
          </Link>

          <p className="text-xs text-foreground/35 font-body pt-1">
            Trusted by <span className="text-foreground/60 font-bold">1.2M+</span> South Africans &middot; <span className="text-foreground/60 font-bold">450</span> active branches
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-20">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-foreground mx-auto" />
        </div>
      </section>

      {/* ── Where available ───────────────────────────────────────────────── */}
      <section className="py-14 bg-background overflow-hidden">
        <div className="px-6 md:px-10 mb-6">
          <h2 className="text-xs font-headline font-bold uppercase tracking-[0.25em] text-primary">
            Where QueUp is available
          </h2>
        </div>

        <div className="relative">
          <div className="flex gap-4 overflow-x-auto pb-6 px-6 md:px-10 scrollbar-hide snap-x snap-mandatory">
            {departments.map((dept, i) => (
              <div
                key={i}
                className="relative flex-shrink-0 w-44 h-56 bg-card rounded-2xl border border-white/8 overflow-hidden hover:scale-[1.03] hover:border-primary/40 transition-all snap-start cursor-pointer group"
              >
                <Image
                  src={dept.image}
                  alt={dept.name}
                  fill
                  className="object-contain p-4 bg-white group-hover:scale-105 transition-transform duration-300"
                  sizes="176px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <h3 className="absolute bottom-3 left-3 right-3 font-headline font-bold text-xs leading-snug text-white">
                  {dept.name}
                </h3>
              </div>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-6 w-24 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <section className="py-16 bg-card border-y border-white/5">
        <div className="container mx-auto px-6 grid grid-cols-3 gap-6 text-center">
          {[
            { value: '1.2M+', label: 'Hours saved' },
            { value: '450',   label: 'Active branches' },
            { value: '4.9/5', label: 'User satisfaction' },
          ].map(({ value, label }) => (
            <div key={label} className="space-y-1">
              <div className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold text-primary">
                {value}
              </div>
              <p className="text-muted-foreground font-body text-xs sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="py-10 bg-background border-t border-white/5 text-center space-y-2">
        <div className="flex items-center justify-center gap-0.5">
          <span className="text-xl font-headline font-extrabold text-foreground">Que</span>
          <span className="text-xl font-headline font-extrabold text-primary">Up</span>
        </div>
        <p className="text-muted-foreground text-sm">© 2026 QueUp SA. All rights reserved.</p>
      </footer>
    </main>
  );
}
