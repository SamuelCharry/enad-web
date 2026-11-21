import { createContext, useContext } from 'react'

export const GuideReceipt = createContext<((pending: boolean) => void) | undefined>(undefined)
export const useGuideReceipt = () => useContext(GuideReceipt)
