import { HTMLAttributes } from 'react';

export function Sidebar({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <aside className={`ui-sidebar ${className}`.trim()} {...props} />;
}
