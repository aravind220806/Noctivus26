export function DropdownMenu({ className = '', ...props }) {
  return <div className={`ui-dropdown-menu ${className}`.trim()} {...props} />;
}

export function DropdownMenuContent({ className = '', ...props }) {
  return <div className={`ui-dropdown-menu__content ${className}`.trim()} {...props} />;
}

export function DropdownMenuItem({ className = '', ...props }) {
  return <button className={`ui-dropdown-menu__item ${className}`.trim()} {...props} />;
}
