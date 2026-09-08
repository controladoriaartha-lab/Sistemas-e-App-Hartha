import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-medium tracking-widest uppercase",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        paper: "bg-paper/10 text-paper",
        accent: "bg-accent/15 text-accent",
        warn: "bg-warn/15 text-warn",
        ok: "bg-ok/15 text-ok",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
