import React from 'react';

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
  color?: string;
}

const SIZE_MAP = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'sm',
  className = '',
  label,
  color = 'text-cyan-400',
}) => {
  return (
    <div className="inline-flex items-center gap-2 select-none font-mono" role="status" aria-live="polite">
      <svg
        className={`animate-spin ${SIZE_MAP[size]} ${color} ${className} motion-reduce:animate-pulse`}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="text-xs text-slate-300 font-semibold">{label}</span>}
      <span className="sr-only">{label || 'Loading...'}</span>
    </div>
  );
};
