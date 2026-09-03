export function StatsSection() {
  const values = [
    ['09', 'Events'],
    ['05', 'Technical events'],
    ['03', 'Non-technical events'],
    ['01', 'Workshop'],
    ['26 Sep', 'Event date'],
  ];
  return (
    <div className="stats-grid" data-reveal>
      {values.map(([value, label]) => (
        <div className="stat" key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
