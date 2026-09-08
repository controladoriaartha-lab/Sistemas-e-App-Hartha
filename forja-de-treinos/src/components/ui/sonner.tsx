import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "bg-card text-foreground border-border shadow-[0_0_0_1px_rgba(244,239,232,0.08)]",
          title: "text-foreground",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

export { Toaster };
