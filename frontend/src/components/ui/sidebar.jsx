export function Sidebar({ className = '', ...props }) {
  return <aside className={`ui-sidebar ${className}`.trim()} {...props} />;
}
