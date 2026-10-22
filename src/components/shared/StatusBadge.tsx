import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const badge = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    tone: {
      success: "bg-success/12 text-success",
      warning: "bg-warning/25 text-warning-foreground",
      danger: "bg-destructive/10 text-destructive",
      neutral: "bg-muted text-muted-foreground",
      info: "bg-secondary text-secondary-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function StatusBadge({ tone, children, className }: VariantProps<typeof badge> & { children: ReactNode; className?: string }) {
  return (
    <span className={cn(badge({ tone }), className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
