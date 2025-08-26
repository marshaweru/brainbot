import "./globals.css";
import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import { Sora, Inter } from "next/font/google";

const heading = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-heading",
  display: "swap",
});
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BrainBot — KCSE Study Assistant",
  description: "KCSE-only sessions: notes, quizzes, assignments, red-pen feedback.",
  openGraph: {
    title: "BrainBot — KCSE Study Assistant",
    description: "KCSE-only sessions: notes, quizzes, assignments, red-pen feedback.",
    url: "https://yourdomain.xyz",
    siteName: "BrainBot",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BrainBot — KCSE Study Assistant",
    description: "KCSE-only sessions with examiner-grade marking.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body className="body-bg min-h-screen font-body antialiased">
        <SiteHeader />
        <div className="mx-auto max-w-6xl px-5">
          <main className="mt-8">{children}</main>
          <footer className="mt-16 text-center text-gray-400 text-sm">
            brainbot • learn smart, win exams
          </footer>
        </div>
      </body>
    </html>
  );
}
