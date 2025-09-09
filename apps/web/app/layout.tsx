import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-brand-100 via-white to-blue-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
        {children}
      </body>
    </html>
  );
}
