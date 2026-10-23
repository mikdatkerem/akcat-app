import type { ReactNode, SVGProps } from 'react'

const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
  sales: <><path d="m3 3 2 0 3 12h10l3-9H6M10 6v6m-3-3h6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  payments: <><path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v12H5a3 3 0 0 1-3-3V6" /><path d="M20 12h-5v5h5" /><path d="M16 14.5h.01" /></>,
  credit: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  products: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  droplet: <path d="M12 2C9 6 5 10 5 14a7 7 0 0 0 14 0c0-4-4-8-7-12Z" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  navigation: <path d="m21 3-6 18-4-8-8-4 18-6Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...props}
      aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  )
}
