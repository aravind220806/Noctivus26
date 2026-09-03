export function SectionTitle({ kicker, title, description }) {
  return (
    <header className="section-title" data-reveal>
      <div>
        <span className="kicker">{kicker}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </header>
  );
}
