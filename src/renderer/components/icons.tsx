interface IconProps {
  size?: number;
  className?: string;
}

function svgProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': true,
  } as const;
}

export function PlayIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} fill="currentColor" stroke="none">
      <path d="M7 4.5a1 1 0 0 1 1.52-.86l11 7.5a1 1 0 0 1 0 1.72l-11 7.5A1 1 0 0 1 7 19.5z" />
    </svg>
  );
}

export function StopIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} fill="currentColor" stroke="none">
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

export function TerminalIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export function MoreVerticalIcon({ size = 15, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

export function PencilIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export function TrashIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function FolderIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function PlusIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} strokeWidth={2.5}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function MinusIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function MaximizeIcon({ size = 11, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)} strokeWidth={2.2}>
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
    </svg>
  );
}

export function ZapIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

export function ExternalLinkIcon({ size = 12, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function SunIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

export function MoonIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z" />
    </svg>
  );
}

export function MonitorIcon({ size = 14, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M8.5 20h7M12 16.5V20" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function CloseIcon({ size = 13, className }: IconProps) {
  return (
    <svg {...svgProps(size, className)}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function SpinupLogo({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="92 72 1086 1086"
      fill="#D4915C"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M 619.41 188.13 C 612.19 189.76, 605.05 195.05, 594.57 206.52 C 583.43 218.7, 546.93 259.22, 504.94 306 C 476.7 337.46, 445.96 371.59, 416.74 403.95 C 398.63 424, 393.94 431.24, 391.93 442.3 C 389.14 457.66, 399.43 475.63, 415.23 483.01 C 425.09 487.62, 431.98 488.12, 475.93 487.37 L 515.5 486.7 521.18 488.36 C 527.46 490.19, 531.64 493.72, 534.6 499.68 L 536.5 503.5 537 543.5 C 537.66 596.49, 536.43 714.5, 535.01 734 C 530.74 792.62, 509.7 816.8, 448.82 833.02 C 438.8 835.68, 432.75 837.82, 431.26 839.22 L 428.99 841.36 430.25 843.24 C 431.83 845.61, 443.19 850.57, 459.15 855.86 C 561.08 889.64, 716.81 886.17, 810.44 848.03 C 822.35 843.18, 825 841.55, 825 839.1 C 825 836.05, 823.09 835.22, 804.26 830.07 C 746.97 814.41, 726.29 792.98, 720.99 743.76 C 718.84 723.83, 717.77 658.49, 718.34 581.82 L 718.91 504.14 720.51 500.33 C 722.53 495.49, 725.45 492.37, 730.5 489.65 L 734.5 487.5 783 487 L 831.5 486.49 837.34 484.14 C 854.11 477.39, 865.34 460.04, 863.61 443.55 C 862.46 432.53, 857.97 425.1, 841.61 407.14 C 838.25 403.46, 826.28 390.13, 815 377.53 C 793.71 353.74, 773.3 331.08, 728.1 281.05 C 713.47 264.86, 690.56 239.43, 677.2 224.55 C 663.83 209.67, 650.92 196.01, 648.5 194.19 C 640.16 187.91, 629.89 185.78, 619.41 188.13 M 798.42 583.89 C 789.96 589.04, 792.32 599.76, 802.76 603.58 C 846.71 619.66, 871.33 631.79, 897.03 650.02 C 946.32 684.97, 968.13 733.33, 953.49 775.24 C 920.99 868.25, 727.88 930.08, 537.5 908.42 C 437.29 897.03, 335.73 857.87, 305.18 818.84 C 274.19 779.26, 287.55 735.38, 341.5 699.53 C 371.5 679.6, 417.61 659.51, 462.04 647.01 C 468.61 645.16, 474.92 642.72, 476.84 641.28 C 491.23 630.44, 484.37 607.46, 466.85 607.86 C 453.13 608.16, 400.34 618.25, 372.23 625.94 C 257.85 657.21, 188.58 709.91, 173.35 777.25 C 150.1 880.01, 275.66 986.02, 465.56 1023.95 C 546.92 1040.21, 641.3 1043.27, 727 1032.44 C 964.06 1002.49, 1119.65 876.4, 1077.98 748 C 1053.86 673.69, 957.93 612.43, 823.6 585.56 C 802.95 581.43, 802.49 581.4, 798.42 583.89"
      />
    </svg>
  );
}
