import React from 'react';

interface TurnitScopeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
  subtitle?: string;
  iconOnly?: boolean;
  className?: string;
}

export const OriginalityCheckLogo: React.FC<TurnitScopeLogoProps> = ({
  size = 'md',
  variant = 'light',
  showSubtitle = true,
  subtitle = '',
  iconOnly = false,
  className = '',
}) => {
  const isDark = variant === 'dark';

  // Dimension scaling
  const dimensions = {
    sm: { iconSize: 28, titleSize: 'text-[15px]', subSize: 'text-[8px]' },
    md: { iconSize: 32, titleSize: 'text-lg', subSize: 'text-[9px]' },
    lg: { iconSize: 40, titleSize: 'text-2xl', subSize: 'text-[11px]' },
    xl: { iconSize: 48, titleSize: 'text-3xl', subSize: 'text-[13px]' },
  }[size];

  return (
    <div
      className={`inline-flex min-w-0 select-none items-center gap-2.5 ${className}`}
      role="img"
      aria-label="TurnitScope"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
        isDark
          ? 'border-white/10 bg-gradient-to-br from-slate-800 to-slate-900'
          : 'border-indigo-100 bg-gradient-to-br from-indigo-50 to-sky-100'
      }`}>
        <svg
          viewBox="0 0 160 160"
          className="shrink-0"
          aria-hidden="true"
          style={{ width: dimensions.iconSize, height: dimensions.iconSize }}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
        {/* Pixel / Data Cubes on Left */}
        <rect x="18" y="70" width="10" height="10" rx="1.5" fill="#00a8ff" />
        <rect x="32" y="70" width="10" height="10" rx="1.5" fill="#0066ff" />
        <rect x="32" y="58" width="10" height="10" rx="1.5" fill="#0088ff" />
        <rect x="10" y="84" width="10" height="10" rx="1.5" fill="#0052cc" />
        <rect x="22" y="84" width="10" height="10" rx="1.5" fill="#0099ff" />
        <rect x="34" y="84" width="10" height="10" rx="1.5" fill="#0040b0" />
        <rect x="14" y="98" width="10" height="10" rx="1.5" fill="#0070f3" />
        <rect x="26" y="98" width="10" height="10" rx="1.5" fill="#00a6ff" />

        {/* Outer Circular Accent Ring Fragment */}
        <path
          d="M 50 105 A 40 40 0 1 0 95 130"
          stroke="#0066ff"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />

        {/* Document Page Outline */}
        <path
          d="M 58 54 
             C 58 48, 62 44, 68 44 
             L 94 44 
             C 98 44, 106 50, 108 55 
             L 112 65 
             C 114 69, 114 74, 114 78 
             L 114 104 
             C 114 112, 108 116, 102 116 
             L 70 116 
             C 64 116, 58 112, 58 104 
             Z"
          stroke="#0066ff"
          strokeWidth="6"
          strokeLinejoin="round"
          fill={isDark ? '#0f172a' : '#ffffff'}
        />

        {/* Top-Right Dog-Ear / Corner Notch */}
        <path
          d="M 94 45 L 94 58 C 94 62, 97 65, 101 65 L 112 65"
          stroke="#0066ff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Document Text Lines */}
        <path
          d="M 68 76 L 86 76"
          stroke="#0066ff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M 68 88 L 80 88"
          stroke="#0066ff"
          strokeWidth="4.5"
          strokeLinecap="round"
        />

        {/* Bold Checkmark inside document */}
        <path
          d="M 74 98 L 88 112 L 122 76"
          stroke="#0066ff"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Graduation Cap (Mortarboard) on top */}
        <g id="grad-cap">
          {/* Diamond cap top */}
          <polygon
            points="58,26 84,36 58,46 32,36"
            fill={isDark ? '#e2e8f0' : '#0c1e36'}
          />
          {/* Skull cap base under diamond */}
          <path
            d="M 44 41 C 44 48, 72 48, 72 41"
            fill={isDark ? '#cbd5e1' : '#0c1e36'}
          />
          {/* Button on cap */}
          <circle cx="58" cy="36" r="2.5" fill="#0066ff" />
          {/* Tassel cord & hanging charm */}
          <path
            d="M 58 36 C 48 37, 38 43, 37 54"
            stroke={isDark ? '#cbd5e1' : '#0c1e36'}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <rect x="35" y="53" width="3" height="7" rx="1" fill={isDark ? '#cbd5e1' : '#0c1e36'} />
        </g>
        </svg>
      </span>

      {/* Brand Text — "TurnitScope" */}
      {!iconOnly && (
        <div className="flex min-w-0 flex-col justify-center">
          <div className={`flex items-baseline gap-1 whitespace-nowrap font-extrabold leading-none tracking-[-0.045em] ${dimensions.titleSize}`}>
            <span className={isDark ? 'text-white' : 'text-slate-900'}>Turnit</span>
            <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">Scope</span>
          </div>

          {showSubtitle && subtitle && (
            <div
              className={`mt-1 whitespace-nowrap font-semibold tracking-[0.08em] uppercase ${dimensions.subSize} ${
                isDark ? 'text-slate-400' : 'text-slate-400'
              }`}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
