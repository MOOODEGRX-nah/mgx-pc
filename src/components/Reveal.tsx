import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Extra delay in ms before the animation starts once visible. */
  delay?: number;
}

/**
 * Fades its content up the first time it scrolls into view.
 * Content is only hidden after JS runs (data-reveal="pending"), so it stays
 * visible without IntersectionObserver, when printing, and for crawlers.
 */
export function Reveal({ children, as: Tag = "div", className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<"pending" | "shown">(() =>
    typeof IntersectionObserver === "undefined" ? "shown" : "pending",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || state === "shown") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [state]);

  const style = delay ? ({ animationDelay: `${delay}ms` } as CSSProperties) : undefined;
  return (
    <Tag ref={ref} data-reveal={state} className={className} style={style}>
      {children}
    </Tag>
  );
}
