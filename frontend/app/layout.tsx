import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "BountyBase",
  description: "Decentralized Bounty Escrow on Algorand",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@300;400;600;700;800&family=Dela+Gothic+One&display=swap"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-surface overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
        <AuthProvider>
          <WalletProvider>
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto pt-32 pb-12">
              {children}
            </main>
            <Footer />
            <Toaster position="bottom-right" />
          </WalletProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
