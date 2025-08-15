import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "BrainBot — KCSE Study Assistant",
  description: "KCSE-only sessions: notes, quizzes, assignments, red-pen feedback.",
  openGraph: {
    title: "BrainBot — KCSE Study Assistant",
    description: "KCSE-only sessions: notes, quizzes, assignments, red-pen feedback.",
    url: "http://localhost:4321",
    siteName: "BrainBot",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "BrainBot — KCSE Study Assistant", description: "KCSE-only sessions with examiner-grade marking.", images: ["/og.png"] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="body-bg min-h-screen">
        <div className="mx-auto max-w-6xl px-5 py-6">
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span className="text-white text-xl font-semibold">BrainBot</span>
            </Link>
            <nav className="flex gap-5 text-gray-200">
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
              <Link href="/dashboard" className="hover:text-white">My Space</Link>
              <Link href="/login" className="hover:text-white">Login</Link>
            </nav>
          </header>
          <main className="mt-8">{children}</main>
          <footer className="mt-16 text-center text-gray-400 text-sm">
            brainbot • learn smart, win exams
          </footer>
        </div>
      </body>
    </html>
  );
}
