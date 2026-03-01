import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const montserrat = Montserrat({
  variable: "--font-family",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Amazarashi Fan Page",
  description: "Fan Page of Amazarashi Page by Guilherme",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body className="antialiased">
        <div className="bg-neutral-900 min-h-screen text-white">
          <nav className="flex justify-between items-center bg-neutral-800 px-6 py-3 border-neutral-700 border-b">
            <div className="flex items-center gap-6">
              <Link
                href=""
                className="font-bold text-white hover:text-neutral-300 text-lg"
              >
                Admin
              </Link>
              <Link
                href="/albums"
                className="text-neutral-300 hover:text-white text-sm"
              >
                Álbuns
              </Link>
              <Link
                href="/songs"
                className="text-neutral-300 hover:text-white text-sm"
              >
                Músicas
              </Link>
            </div>
          </nav>
          <main className="p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
