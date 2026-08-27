import type { ElementType, ReactNode, CSSProperties } from 'react';

export interface RevealTextProps {
  children?: ReactNode;
  className?: string;
  as?: ElementType;
}

export default function RevealText({ children, className = '', as: Tag = 'span' }: RevealTextProps) {
  const textString = typeof children === 'string' || typeof children === 'number' ? String(children) : '';
  const words = textString ? textString.split(' ') : [];

  return (
    <Tag className={`reveal-text ${className}`} aria-label={textString || undefined}>
      {words.map((word, index) => (
        <span
          className="reveal-text__word"
          style={{ '--word-index': index } as CSSProperties}
          aria-hidden="true"
          key={`${word}-${index}`}
        >
          {word}&nbsp;
        </span>
      ))}
    </Tag>
  );
}
