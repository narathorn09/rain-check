/** น้องฝน profile picture: a small rain cloud on a white circle (styled by .avatar). */
export function Avatar() {
  return (
    <div className="avatar" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 100 100">
        <path d="M28 60a16 16 0 0 1 2-32 22 22 0 0 1 42 6 13 13 0 0 1-2 26z" fill="#4a8fd8" />
        <g stroke="#06893b" strokeWidth="8" strokeLinecap="round">
          <line x1="34" y1="72" x2="29" y2="87" />
          <line x1="52" y1="72" x2="47" y2="87" />
          <line x1="70" y1="72" x2="65" y2="87" />
        </g>
      </svg>
    </div>
  );
}
