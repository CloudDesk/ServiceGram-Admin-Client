import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorState } from '../../../components/ui/ErrorState'
import { PageContainer } from '../../../components/layout/PageContainer'
import { Skeleton } from '../../../components/ui/Skeleton'
import { routePaths } from '../../../config/routes'
import { marketingCampaignService } from '../services/marketingCampaign.service'
import { MarketingCampaignStudio } from './MarketingCampaignStudio'

export function MarketingCampaignDetailPage() {
  const { campaignId = '' } = useParams<{ campaignId: string }>()
  const navigate = useNavigate()

  const campaignQuery = useQuery({
    queryKey: ['admin', 'marketing-campaign', campaignId],
    queryFn: () => marketingCampaignService.getCampaign(campaignId),
    enabled: Boolean(campaignId),
  })

  const campaign = campaignQuery.data?.data ?? null

  if (campaignQuery.isPending) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    )
  }

  if (campaignQuery.isError || !campaign) {
    return (
      <PageContainer>
        <ErrorState
          description="Marketing campaign details could not be loaded."
          onRetry={() => void campaignQuery.refetch()}
          title="Campaign not found"
        />
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <MarketingCampaignStudio
        campaign={campaign}
        mode="edit"
        onBack={() => navigate(routePaths.marketingCampaigns)}
      />
    </PageContainer>
  )
}
