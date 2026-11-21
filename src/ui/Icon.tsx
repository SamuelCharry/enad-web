const paths = {
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
