import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,transform,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] min-h-11 select-none",
  {
    variants: {
      variant: {
        default: "bg-paper text-ink hover:bg-paper/90",
        secondary:
          "bg-surface text-foreground shadow-[0_0_0_1px_rgba(244,239,232,0.08)] hover:bg-muted",
        outline:
          "bg-transparent text-foreground shadow-[0_0_0_1px_rgba(244,239,232,0.12)] hover:bg-surface",
        ghost: "text-foreground hover:bg-surface",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        destructive: "text-danger shadow-[0_0_0_1px_rgba(214,122,106,0.4)] hover:bg-danger/10",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 min-h-9 px-3 text-xs",
        lg: "h-12 px-5",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
