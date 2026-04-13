export default function Spinner({ className = "" }) {
  return (
    <span
      className={`inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
