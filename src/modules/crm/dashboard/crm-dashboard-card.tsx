import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function CrmDashboardCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Card className={cn("rounded-2xl border-white/[0.08] p-5 md:p-6", className)} {...props}>
      {children}
    </Card>
  );
}

export function CrmDashboardSectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "text-[0.7rem] font-normal uppercase tracking-[0.12em] text-[rgba(255,255,255,0.45)]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function CrmDashboardSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-[rgba(255,255,255,0.08)]", className)} />;
}
