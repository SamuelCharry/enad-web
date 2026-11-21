const colors = ['#B72619', '#CC6B68', '#F0BC40', '#F9D876', '#9BC184', '#56A359']
/** Background and readable foreground for a zero-based level. */
export function levelColor(index0to5: number) {
  return { bg: colors[index0to5] ?? '#E9E9E6', fg: index0to5 === 0 ? '#FFFFFF' : '#1D1D1B' }
}
