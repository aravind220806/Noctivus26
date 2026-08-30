export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ className = '', children }) {
  return <section className={cn('bionis-card', className)}>{children}</section>;
}

export function CardTitle({ children }) {
  return <h2 className="bionis-card-title">{children}</h2>;
}
