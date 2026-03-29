import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SearchProvider } from "@/contexts/SearchContext";
import { ThemeProvider } from "@/components/theme-provider";
import AuthInterceptor from "@/components/AuthInterceptor";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hire-X Hire - AI-Powered Talent Search",
  description:
    "Advanced AI-powered platform for finding and analyzing professional profiles with enrichment data",
  keywords: [
    "talent search",
    "AI recruiting",
    "candidate sourcing",
    "enrichment",
  ],
  authors: [{ name: "Hire-X" }],
  openGraph: {
    title: "Hire-X Hire - AI-Powered Talent Search",
    description:
      "Find the best candidates with AI-powered search and enrichment",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem={false}
            disableTransitionOnChange
          >
            <TooltipProvider>
              <AuthProvider>
                <SearchProvider>
                  <AuthInterceptor>{children}</AuthInterceptor>
                </SearchProvider>
              </AuthProvider>
            </TooltipProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}