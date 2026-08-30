export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('bionis-card', className)}>{children}</section>;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="bionis-card-title">{children}</h2>;
}
