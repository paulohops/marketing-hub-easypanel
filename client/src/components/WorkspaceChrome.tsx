import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkspaceChromeIcon = ComponentType<{ className?: string }>;

export function WorkspaceShell({
  children,
  className,
  as: Component = "main",
}: {
  children: ReactNode;
  className?: string;
  as?: "main" | "div" | "section";
}) {
  return <Component className={cn("hub-page hub-runtime-shell", className)}>{children}</Component>;
}

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: WorkspaceChromeIcon;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("hub-header", className)}>
      <div className="hub-header__identity">
        {Icon ? (
          <span className="hub-header__icon" aria-hidden="true">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? <p className="hub-header__eyebrow">{eyebrow}</p> : null}
          <h1 className="hub-header__title">{title}</h1>
          {description ? <p className="hub-header__description">{description}</p> : null}
          {meta ? <div className="hub-header__meta">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="hub-header__actions">{actions}</div> : null}
    </header>
  );
}

export function WorkspaceActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("hub-actions", className)}>{children}</div>;
}

export function WorkspaceSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hub-section", className)}>
      {title || description || actions ? (
        <div className="hub-section__header">
          <div className="min-w-0">
            {title ? <h2 className="hub-section__title">{title}</h2> : null}
            {description ? <p className="hub-section__description">{description}</p> : null}
          </div>
          {actions ? <div className="hub-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function WorkspaceCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("hub-card bg-card text-card-foreground", className)}>{children}</article>;
}
