import { AppShell } from "@/components/layout/app-shell";
import { PlatformAuthGate } from "@/components/layout/platform-auth-gate";

/**
 * Hero (greeting/clocks) is rendered inside AppShell on most routes. Portfolio hides it
 * so the module can use the full content area for the editable LP.
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlatformAuthGate>
      <AppShell>{children}</AppShell>
    </PlatformAuthGate>
  );
}
