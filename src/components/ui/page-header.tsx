export function PageHeader({
  title,
  subtitle,
  titleExtra,
  action,
}: {
  title: string;
  subtitle?: string;
  titleExtra?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-4xl font-light uppercase leading-none tracking-[0.08em] text-[var(--text)]">{title}</h1>
          {titleExtra}
        </div>
        {subtitle ? <p className="mt-2 text-sm font-light text-[var(--muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
