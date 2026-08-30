import { HTMLAttributes } from 'react';

export function DropdownMenu({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-dropdown-menu ${className}`.trim()} {...props} />;
}

export function DropdownMenuContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-dropdown-menu__content ${className}`.trim()} {...props} />;
}

export function DropdownMenuItem({ className = '', ...props }: HTMLAttributes<HTMLButtonElement>) {
  return <button className={`ui-dropdown-menu__item ${className}`.trim()} {...props} />;
}
