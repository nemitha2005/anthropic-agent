"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

const CODE_LINES = [
  { text: "const agent = new AnthropicAgent();", color: "text-[#c17d6b]" },
  { text: 'await agent.think("Build something amazing");', color: "text-[#d4957f]" },
  { text: "const result = await agent.stream({", color: "text-[#e0ab96]" },
  { text: '  model: "claude-opus-4-6",', color: "text-yellow-300" },
  { text: '  context: "unlimited",', color: "text-yellow-300" },
  { text: "});", color: "text-[#e0ab96]" },
  { text: "// result: your ideas, amplified ✦", color: "text-zinc-500 italic" },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Streaming responses",
    desc: "Real-time token streaming with zero latency feel",
  },
  {
    icon: "🧠",
    title: "Claude models",
    desc: "Haiku · Sonnet · Opus — pick your intelligence tier",
  },
  {
    icon: "📁",
    title: "Persistent history",
    desc: "Every conversation saved, searchable, resumable",
  },
  {
    icon: "🎨",
    title: "Artifact canvas",
    desc: "Generate code, docs, sheets and images inline",
  },
];

function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setVisible((v) => !v), 530);
    return () => clearInterval(t);
  }, []);
  return (
    <span className={`inline-block w-2 h-4 ml-0.5 ${visible ? "opacity-100" : "opacity-0"}`} style={{ backgroundColor: "#c17d6b" }} />
  );
}

function CodeBlock() {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (revealed >= CODE_LINES.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 420);
    return () => clearTimeout(t);
  }, [revealed]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-5 font-mono text-sm shadow-2xl shadow-black/60 w-full max-w-md">
      <div className="flex gap-1.5 mb-4">
        <span className="size-3 rounded-full bg-red-500/80" />
        <span className="size-3 rounded-full bg-yellow-500/80" />
        <span className="size-3 rounded-full" style={{ backgroundColor: "#c17d6b" }} />
      </div>
      <div className="space-y-1.5">
        {CODE_LINES.map((line, i) => (
          <motion.div
            key={line.text}
            animate={{ opacity: i < revealed ? 1 : 0, x: i < revealed ? 0 : -8 }}
            className={`${line.color} leading-relaxed`}
            initial={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.25 }}
          >
            {line.text}
          </motion.div>
        ))}
        {revealed < CODE_LINES.length && <BlinkingCursor />}
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="relative min-h-dvh bg-zinc-950 text-white overflow-hidden flex flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(193,125,107,0.15), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Anthropic Agent" width={28} height={28} className="rounded-lg" />
          <span className="font-semibold text-white tracking-tight">Anthropic Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="text-zinc-300 hover:text-white">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="text-white hover:opacity-90" style={{ backgroundColor: "#c17d6b" }}>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 md:px-12">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center max-w-2xl"
          initial={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: "rgba(193,125,107,0.35)", backgroundColor: "rgba(193,125,107,0.1)", color: "#d4957f" }}>
            <span className="size-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#c17d6b" }} />
            Powered by Claude · Built for developers
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Your AI agent,{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(to right, #c17d6b, #d4957f, #e0ab96)" }}>
              ready to build
            </span>
          </h1>

          <p className="mt-5 text-base text-zinc-400 md:text-lg leading-relaxed max-w-lg">
            A full-featured AI chat platform with streaming, persistent history,
            multi-model support, and an artifact canvas — all in one place.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="text-white px-8 hover:opacity-90" style={{ backgroundColor: "#c17d6b" }}>
              <Link href="/register">Start for free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800">
              <Link href="/login">Sign in to your account</Link>
            </Button>
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-16 w-full flex justify-center"
          initial={{ opacity: 0, y: 32 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        >
          <CodeBlock />
        </motion.div>

        <motion.div
          animate={{ opacity: 1 }}
          className="mt-20 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl w-full"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-medium text-sm text-white mb-1">{f.title}</div>
              <div className="text-xs text-zinc-500 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </motion.div>
      </main>

      <footer className="relative z-10 py-6 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Anthropic Agent — built with Next.js & Claude
      </footer>
    </div>
  );
}