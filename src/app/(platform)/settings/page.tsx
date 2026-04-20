import { ModuleGuard } from "@/components/layout/module-guard";
import { SettingsModule } from "@/modules/settings/settings-module";

export default function SettingsPage() {
  return (
    <ModuleGuard requireAdmin>
      <SettingsModule />
    </ModuleGuard>
  );
}
