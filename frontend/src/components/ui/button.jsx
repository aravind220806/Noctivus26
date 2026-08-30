export function Button({ className = '', ...props }) {
  return <button className={`button ${className}`.trim()} {...props} />;
}
