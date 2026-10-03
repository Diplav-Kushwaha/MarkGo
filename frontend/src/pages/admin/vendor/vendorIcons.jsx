// Inline SVG glyphs for the Vendor page. Kept in one module so the page files
// stay readable and every icon shares the same stroke conventions.

const BASE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

function Icon({ className = "w-4 h-4", children }) {
  return (
    <svg className={className} {...BASE} aria-hidden="true">
      {children}
    </svg>
  );
}

export const PlusIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SearchIcon = ({ className }) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const FilterIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M3 5h18M6 12h12M10 19h4" />
  </Icon>
);

export const CloseIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronDownIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const ChevronLeftIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

export const SortIcon = ({ className, direction }) => (
  <Icon className={className}>
    {direction === "asc" ? (
      <path d="M12 19V5M6 11l6-6 6 6" />
    ) : (
      <path d="M12 5v14M6 13l6 6 6-6" />
    )}
  </Icon>
);

export const UnsortedIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
  </Icon>
);

export const TruckIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M3 16V6a1 1 0 011-1h9v11" />
    <path d="M13 9h4l4 4v3h-8" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Icon>
);

export const WalletIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M3 8a2 2 0 012-2h13a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <path d="M16 12h3" />
  </Icon>
);

export const CheckCircleIcon = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </Icon>
);

export const PauseCircleIcon = ({ className }) => (
  <Icon className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9v6M14 9v6" />
  </Icon>
);

export const PencilIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </Icon>
);

export const TrashIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const EyeIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />
    <circle cx="12" cy="12" r="2.5" />
  </Icon>
);

export const LinkIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1" />
    <path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />
  </Icon>
);

export const PowerIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 4v8" />
    <path d="M7 7a7 7 0 109 0" />
  </Icon>
);

export const DownloadIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 4v11M8 11l4 4 4-4" />
    <path d="M4 20h16" />
  </Icon>
);

export const UploadIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 16V5M8 9l4-4 4 4" />
    <path d="M4 20h16" />
  </Icon>
);

export const CopyIcon = ({ className }) => (
  <Icon className={className}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M15 5H6a2 2 0 00-2 2v9" />
  </Icon>
);

export const CheckIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M5 13l4 4L19 7" />
  </Icon>
);

export const RefreshIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M20 12a8 8 0 10-2.3 5.6" />
    <path d="M20 5v5h-5" />
  </Icon>
);

export const AlertIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
);

export const BuildingIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16" />
    <path d="M14 9h5a2 2 0 012 2v10" />
    <path d="M7 7h3M7 11h3M7 15h3M17 13h2M17 17h2" />
  </Icon>
);

export const PhoneIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M5 4h4l2 5-2.5 1.5a13 13 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" />
  </Icon>
);

export const MailIcon = ({ className }) => (
  <Icon className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </Icon>
);

export const MapPinIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const BankIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M3 10l9-6 9 6" />
    <path d="M5 10v9M19 10v9M3 20h18M9 14v5M15 14v5" />
  </Icon>
);

export const LockIcon = ({ className }) => (
  <Icon className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Icon>
);

export const FileTextIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icon>
);

export const UsersIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M16 20v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1" />
    <circle cx="10" cy="8" r="3.5" />
    <path d="M20 20v-1a4 4 0 00-3-3.85" />
  </Icon>
);

export const TagIcon = ({ className }) => (
  <Icon className={className}>
    <path d="M11 3H5a2 2 0 00-2 2v6l10 10 8-8z" />
    <circle cx="8" cy="8" r="1.5" />
  </Icon>
);
