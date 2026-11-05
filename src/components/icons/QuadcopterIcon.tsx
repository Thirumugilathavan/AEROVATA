import React from 'react';

interface QuadcopterIconProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  color?: string;
}

/**
 * High-fidelity, unmistakably recognizable Quadcopter / Multirotor UAV Icon.
 * Features an X-frame airframe, 4 distinct motor arms, rotor discs,
 * central avionics fuselage pod, and forward-heading sensor chevron.
 */
export const QuadcopterIcon: React.FC<QuadcopterIconProps> = ({
  className = '',
  size = 20,
  style,
  color = 'currentColor',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
    >
      {/* 4 Diagonal Carbon-Fiber Arms (X-configuration) */}
      <line x1="12" y1="12" x2="6" y2="6" strokeWidth="2" />
      <line x1="12" y1="12" x2="18" y2="6" strokeWidth="2" />
      <line x1="12" y1="12" x2="6" y2="18" strokeWidth="2" />
      <line x1="12" y1="12" x2="18" y2="18" strokeWidth="2" />

      {/* 4 Motor Hubs & Spinning Rotor Discs */}
      {/* Front-Left Rotor */}
      <circle cx="5" cy="5" r="3.2" strokeWidth="1.25" strokeDasharray="2 1" />
      <circle cx="5" cy="5" r="1.1" fill={color} />
      {/* Front-Right Rotor */}
      <circle cx="19" cy="5" r="3.2" strokeWidth="1.25" strokeDasharray="2 1" />
      <circle cx="19" cy="5" r="1.1" fill={color} />
      {/* Rear-Left Rotor */}
      <circle cx="5" cy="19" r="3.2" strokeWidth="1.25" strokeDasharray="2 1" />
      <circle cx="5" cy="19" r="1.1" fill={color} />
      {/* Rear-Right Rotor */}
      <circle cx="19" cy="19" r="3.2" strokeWidth="1.25" strokeDasharray="2 1" />
      <circle cx="19" cy="19" r="1.1" fill={color} />

      {/* Central Aerodynamic Avionics Fuselage Pod */}
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.5" fill="currentColor" fillOpacity="0.2" strokeWidth="1.5" />
      
      {/* Forward Flight Heading Direction Indicator (Top arrow/chevron) */}
      <path d="M12 7.5L13.5 10H10.5L12 7.5Z" fill={color} strokeWidth="0.5" />

      {/* Central Flight Controller Beacon Dot */}
      <circle cx="12" cy="12" r="0.9" fill={color} />
    </svg>
  );
};

export default QuadcopterIcon;
