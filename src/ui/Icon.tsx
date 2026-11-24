const paths = {
  home: 'm3 10 9-7 9 7v11h-6v-7H9v7H3z',
  groups: 'M2 20v-2a5 5 0 0 1 10 0v2M7 4a3 3 0 1 0 .01 0M15 4a3 3 0 1 1 0 6m0 3a6 6 0 0 1 7 6',
  student: 'm2 9 10-5 10 5-10 5L2 9zm4 3v5c4 3 8 3 12 0v-5m4-3v7',
  person: 'M12 3a4 4 0 1 0 .01 0M4 21v-2a8 8 0 0 1 16 0v2',
  upload: 'M12 17V3m-6 6 6-6 6 6M3 17v4h18v-4',
  download: 'M12 3v14m-6-6 6 6 6-6M3 17v4h18v-4',
  help: 'M12 2a10 10 0 1 0 .01 0M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3h.01',
  school: 'M3 21V8l9-5 9 5v13H3zm6 0v-6h6v6M7 10h1m8 0h1',
  calendar: 'M3 6h18v15H3zM3 10h18M7 3v5m10-5v5',
  menu: 'M3 6h18M3 12h18M3 18h18',
  scan: 'M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6m4-3h10',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  back: 'M20 12H5m6 6-6-6 6-6',
  enter: 'M4 12h12m-5-5 5 5-5 5m6-14h4v18h-4',
  edit: 'M13 5H5v15h15v-8M10 15l1-4 8-8 3 3-8 8-4 1z',
  chart: 'M3 3v18h18M7 16v-5m5 5V6m5 10v-7',
  check: 'm4 12 5 5L20 6',
  clock: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zm0 4v5l4 2',
  book: 'M12 6C9 4 6 4 2 5v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1zm0 0v14',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z',
}
export function Icon({ name, size = 22 }: { name: keyof typeof paths; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}

export type IconName = keyof typeof paths
