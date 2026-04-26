import { useQuery } from '@tanstack/react-query'
import { lookupBarcode, type KassalappProduct } from '@/lib/kassalapp'

const EAN_RE = /^\d{8,14}$/

export function useKassalappBarcode(ean: string) {
  const trimmed = ean.trim()
  return useQuery<KassalappProduct | null>({
    queryKey: ['kassalapp-barcode', trimmed],
    enabled: EAN_RE.test(trimmed),
    queryFn: () => lookupBarcode(trimmed),
    staleTime: 24 * 60 * 60 * 1000, // barcode data doesn't change day-to-day
    retry: false,
  })
}
