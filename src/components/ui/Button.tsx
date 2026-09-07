import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors transition-transform duration-150 ease-out select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  secondary: "bg-surface-raised text-ink border border-line hover:border-line-strong",
  ghost: "bg-transparent text-ink-muted hover:bg-accent-soft hover:text-accent-ink",
  danger: "bg-danger text-white hover:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm min-w-11",
  lg: "h-12 px-5 text-base min-w-12",
};

type StyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
};

const styleKeys = ["variant", "size", "className", "children"] as const;

type ButtonAsButton = StyleProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: never };

type ButtonAsLink = StyleProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function isLink(props: ButtonProps): props is ButtonAsLink {
  return typeof props.href === "string";
}

/** Shallow-omit the shared style props, leaving only element-specific attributes to spread. */
function nativeProps<T extends ButtonProps>(props: T): Omit<T, (typeof styleKeys)[number]> {
  const rest = { ...props };
  for (const key of styleKeys) delete rest[key];
  return rest;
}

/** Primary UI button. Pass `href` to render a Next.js Link styled the same way as a button. */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn(base, variants[variant], sizes[size], className);

  if (isLink(props)) {
    return (
      <Link {...nativeProps(props)} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" {...nativeProps(props)} className={classes}>
      {children}
    </button>
  );
}
