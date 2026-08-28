export default function RevealText({ children, className = '', as: Tag = 'span' }) {
  const words = String(children).split(' ');
  return (
    <Tag className={`reveal-text ${className}`} aria-label={children}>
      {words.map((word, index) => (
        <span className="reveal-text__word" style={{ '--word-index': index }} aria-hidden="true" key={`${word}-${index}`}>
          {word}&nbsp;
        </span>
      ))}
    </Tag>
  );
}
