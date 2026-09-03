export function InputGroup({ className = '', ...props }) {
  return <div className={`ui-input-group ${className}`.trim()} {...props} />;
}
