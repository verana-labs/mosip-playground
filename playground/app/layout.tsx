import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MOSIP × Verana, Inji trust integration",
  description:
    "An interactive showcase of MOSIP Inji credentials verified against the Verana Trust Network: who is trusted and accredited, checked live, end to end.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
