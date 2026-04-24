import { AppShell } from "@/components/layout/app-shell";
import { PlatformAuthGate } from "@/components/layout/platform-auth-gate";

/**
 * Hero is rendered inside AppShell so it stays mounted across navigations; HeroSection
 * uses React.memo with no route-based key. Page padding below the hero is on the main
 * content wrapper in app-shell.tsx.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthGate>
      <AppShell>{children}</AppShell>
    </PlatformAuthGate>
  );
}
