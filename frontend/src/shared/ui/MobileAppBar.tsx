import type { ReactNode } from "react";

export function MobileAppBar({ action }: { action?: ReactNode }) {
  return <header className="app-bar">
    <a className="app-brand" href="/" aria-label="한강갈까 홈">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
      <span>한강갈까</span>
    </a>
    {action && <div className="app-bar-action">{action}</div>}
  </header>;
}
