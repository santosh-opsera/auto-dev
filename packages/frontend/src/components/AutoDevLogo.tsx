type AutoDevLogoProps = {
  className?: string;
};

/**
 * Theme-aware AutoDev wordmark for unauthenticated surfaces (login).
 * Uses CSS variables so the mark stays clear in light and dark themes.
 */
export function AutoDevLogo({ className }: AutoDevLogoProps) {
  return (
    <svg
      className={className}
      role="img"
      aria-label="AutoDev"
      viewBox="0 0 168 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="auth-logo__badge" x="0" y="4" width="40" height="40" rx="10" />
      <text
        className="auth-logo__badge-text"
        x="20"
        y="30"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fontFamily="inherit"
      >
        AD
      </text>
      <text
        className="auth-logo__wordmark"
        x="52"
        y="31"
        fontSize="22"
        fontWeight="700"
        fontFamily="inherit"
        letterSpacing="0.02em"
      >
        AutoDev
      </text>
    </svg>
  );
}
