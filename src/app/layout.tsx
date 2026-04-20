import type { Metadata } from "next";
import "./globals.css";
import { MetaAdsProvider } from "@/context/meta-ads-context";
import { LanguageProvider } from "@/context/language-context";
import { AppProviders } from "@/components/providers/app-providers";

export const metadata: Metadata = {
  title: "RocketRide Project Management Platform",
  description: "Dark-first modular workspace for dashboard, projects, finance and reporting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <MetaAdsProvider>
            <AppProviders>{children}</AppProviders>
          </MetaAdsProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
