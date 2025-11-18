import React from "react";
import { Button } from "@/components/ui/button"; // Assuming your existing button component

interface GradientButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
  className?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export default function GradientButton({
  children,
  className,
  gradientFrom = "hsl(var(--primary))",
  gradientTo = "hsl(var(--primary-foreground))",
  ...props
}: GradientButtonProps) {
  return (
    <Button
      className={`relative inline-flex h-10 overflow-hidden rounded-md p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 ${className}`}
      {...props}
    >
      <span
        className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"
        style={{
          backgroundImage: `conic-gradient(from 90deg at 50% 50%, ${gradientFrom} 0%, ${gradientTo} 50%, ${gradientFrom} 100%)`,
        }}
      />
      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-md bg-slate-950 px-3 py-1 text-sm font-medium text-white backdrop-blur-3xl">
        {children}
      </span>
    </Button>
  );
}