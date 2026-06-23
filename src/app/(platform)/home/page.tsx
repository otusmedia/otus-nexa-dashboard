"use client";

import { AgencyHomeGuard } from "@/components/layout/agency-home-guard";
import { AgencyHomeModule } from "@/modules/agency-home/agency-home-module";

export default function AgencyHomePage() {
  return (
    <AgencyHomeGuard>
      <AgencyHomeModule />
    </AgencyHomeGuard>
  );
}
