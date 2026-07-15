import type { Metadata } from "next";
import "./globals.css";
import { MetaAdsProvider } from "@/context/meta-ads-context";
import { LanguageProvider } from "@/context/language-context";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-preference";

export const metadata: Metadata = {
  title: "NXO System",
  description: "NXO System — client operations and performance workspace.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <MetaAdsProvider>
              <AppProviders>{children}</AppProviders>
            </MetaAdsProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
