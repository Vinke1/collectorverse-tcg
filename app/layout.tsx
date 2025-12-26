import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { LanguageProvider } from "@/components/providers/language-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Header } from "@/components/navigation/header";
import { Footer } from "@/components/navigation/footer";
import { createClient } from "@/lib/supabase/server";
import { Toaster } from "sonner";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "CollectorVerse - Collection TCG Ultime",
  description: "Gérez vos collections de cartes TCG (Pokémon, Lorcana, One Piece) avec la plateforme la plus moderne et sophistiquée",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CollectorVerse",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "CollectorVerse",
    title: "CollectorVerse - Collection TCG Ultime",
    description: "Gérez vos collections de cartes TCG avec la meilleure plateforme",
    images: [{ url: "/icon-512x512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CollectorVerse - Collection TCG Ultime",
    description: "Gérez vos collections de cartes TCG avec la meilleure plateforme",
    images: ["/icon-512x512.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <GoogleAnalytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider initialUser={user}>
            <LanguageProvider>
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <Toaster position="bottom-right" theme="system" />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
