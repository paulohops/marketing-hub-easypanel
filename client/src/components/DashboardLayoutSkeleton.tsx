import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      <div className="flex min-h-14 items-center gap-3 border-b border-border/80 bg-background px-4 py-2 lg:hidden">
        <Skeleton className="h-9 w-9 rounded-[var(--hub-control-radius)]" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>

      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-white/20 bg-primary p-3 lg:flex">
        <div className="flex items-center gap-3 px-2 pb-4 pt-2">
          <Skeleton className="h-9 w-9 rounded-[var(--hub-control-radius)] bg-sidebar-accent" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28 bg-sidebar-accent" />
            <Skeleton className="h-2.5 w-20 bg-sidebar-accent" />
          </div>
        </div>
        <div className="space-y-1.5 px-1">
          <Skeleton className="h-[var(--hub-sidebar-item-height)] w-full rounded-[var(--hub-control-radius)] bg-sidebar-accent" />
          <Skeleton className="h-[var(--hub-sidebar-item-height)] w-full rounded-[var(--hub-control-radius)] bg-sidebar-accent" />
          <Skeleton className="h-[var(--hub-sidebar-item-height)] w-full rounded-[var(--hub-control-radius)] bg-sidebar-accent" />
          <Skeleton className="mt-4 h-2.5 w-16 bg-sidebar-accent" />
          <Skeleton className="h-[var(--hub-sidebar-item-height)] w-full rounded-[var(--hub-control-radius)] bg-sidebar-accent" />
          <Skeleton className="h-[var(--hub-sidebar-item-height)] w-full rounded-[var(--hub-control-radius)] bg-sidebar-accent" />
        </div>
        <div className="mt-auto border-t border-white/20 px-1 pt-3">
          <div className="flex items-center gap-3 rounded-[var(--hub-control-radius)] p-2">
            <Skeleton className="h-8 w-8 rounded-full bg-sidebar-accent" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20 bg-sidebar-accent" />
              <Skeleton className="h-2.5 w-28 bg-sidebar-accent" />
            </div>
          </div>
        </div>
      </aside>

      <main className="cluster-grid min-w-0 flex-1 p-[var(--hub-shell-top)] px-[var(--hub-shell-inline)] pb-[var(--hub-shell-bottom)]">
        <div className="mx-auto flex w-full max-w-[var(--hub-content-max)] flex-col gap-[var(--hub-section-gap)]">
          <Skeleton className="h-28 w-full rounded-[var(--hub-card-radius)]" />
          <div className="grid gap-[var(--hub-grid-gap)] sm:grid-cols-3">
            <Skeleton className="h-28 rounded-[var(--hub-card-radius)]" />
            <Skeleton className="h-28 rounded-[var(--hub-card-radius)]" />
            <Skeleton className="h-28 rounded-[var(--hub-card-radius)]" />
          </div>
          <div className="grid gap-[var(--hub-grid-gap)] xl:grid-cols-[1.6fr_1fr]">
            <Skeleton className="h-72 rounded-[var(--hub-card-radius)]" />
            <Skeleton className="h-72 rounded-[var(--hub-card-radius)]" />
          </div>
        </div>
      </main>
    </div>
  );
}
