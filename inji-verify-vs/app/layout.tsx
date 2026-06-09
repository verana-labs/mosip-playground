import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inji Verify × Verana — Trust Check",
  description:
    "MOSIP Inji Verify trust check demo: signature verification plus Verana Trust Resolver issuer accreditation (Phase 1)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
