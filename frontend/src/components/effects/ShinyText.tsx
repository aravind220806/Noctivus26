import type { ReactNode } from 'react';

export interface ShinyTextProps {
  children?: ReactNode;
}

export default function ShinyText({ children }: ShinyTextProps) {
  return <span className="shiny-text">{children}</span>;
}
