import { AppShell } from "@/components/layout/app-shell";
import { PlatformAuthGate } from "@/components/layout/platform-auth-gate";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthGate>
      <AppShell>{children}</AppShell>
    </PlatformAuthGate>
  );
}
