import { useLayoutEffect, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scrolls to the top on new pages (keeps the position on browser back/forward)
 * and fades each page in.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useLayoutEffect(() => {
    if (navType !== "POP") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, navType]);

  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
