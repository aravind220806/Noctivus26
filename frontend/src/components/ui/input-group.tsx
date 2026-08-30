import { HTMLAttributes } from 'react';

export function InputGroup({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-input-group ${className}`.trim()} {...props} />;
}
