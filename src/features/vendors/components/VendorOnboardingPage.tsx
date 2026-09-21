import { Navigate, useLocation, useParams } from 'react-router-dom'
import { buildVendorOnboardingRedirect } from '../vendorRoutes'

/** Keeps bookmarks and backend-generated legacy links working after consolidation. */
export function VendorOnboardingPage() {
  const location = useLocation()
  const { vendorId } = useParams<{ vendorId?: string }>()

  return (
    <Navigate
      replace
      to={buildVendorOnboardingRedirect(
        location.search,
        location.hash,
        vendorId,
      )}
    />
  )
}
