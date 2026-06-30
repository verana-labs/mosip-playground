"use client";

import { Building2, ScrollText, FileCheck2, BadgeCheck, User, ShieldCheck, Check, type LucideIcon } from "lucide-react";

function Node({
  icon: Icon,
  title,
  sub,
  badge,
  accent,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  sub: string;
  badge?: string;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className="relative rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4"
      style={{ animation: "trust-fade-up 0.6s ease-out both", animationDelay: `${delay}s` }}
    >
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-white leading-tight">{title}</p>
          <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
        </div>
      </div>
      {badge && (
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
          <Check className="h-3 w-3" /> {badge}
        </span>
      )}
    </div>
  );
}

function Rail({ label, delay }: { label: string; delay: number }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-1"
      style={{ animation: "trust-fade-up 0.6s ease-out both", animationDelay: `${delay}s` }}
    >
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-violet-400/40" />
      <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-violet-400/40" />
    </div>
  );
}

export default function TrustDiagram() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-6 sm:p-8">
      <div className="trust-grid pointer-events-none absolute inset-0 opacity-50" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />

      <div className="relative mx-auto max-w-md space-y-2">
        <Node
          icon={Building2}
          title="MOSIP Pilot Authority"
          sub="The trust anchor · Ecosystem #167"
          badge="Trusted on the Verana network"
          accent="text-amber-300"
          delay={0}
        />
        <Rail label="defines the credential" delay={0.1} />
        <Node
          icon={ScrollText}
          title="Foundational Resident ID"
          sub="The credential schema · cs#241 · accreditation required"
          accent="text-violet-300"
          delay={0.2}
        />
        <Rail label="accredits issuer · authorizes verifier" delay={0.3} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Node icon={FileCheck2} title="Inji Certify" sub="Issuer" badge="Accredited" accent="text-violet-300" delay={0.4} />
          <Node icon={BadgeCheck} title="Inji Verify" sub="Verifier" badge="Authorized" accent="text-emerald-300" delay={0.45} />
        </div>
        <Rail label="issues to · is checked by" delay={0.5} />
        <Node
          icon={User}
          title="Asha"
          sub="The holder · her Resident ID, trustworthy end to end"
          accent="text-sky-300"
          delay={0.6}
        />
      </div>

      <div
        className="relative mt-6 flex items-center justify-center gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3"
        style={{ animation: "trust-fade-up 0.6s ease-out both", animationDelay: "0.75s" }}
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
        <p className="text-center text-xs text-emerald-100/90">
          Every <span className="font-semibold text-emerald-300">✓</span> is the{" "}
          <span className="font-semibold">Verana Trust Resolver</span> answering live, on-chain, fail-closed.
        </p>
      </div>
    </div>
  );
}
