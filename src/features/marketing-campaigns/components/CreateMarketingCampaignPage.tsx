import { useNavigate } from 'react-router-dom'
import { PageContainer } from '../../../components/layout/PageContainer'
import { routePaths } from '../../../config/routes'
import { MarketingCampaignStudio } from './MarketingCampaignStudio'

export function CreateMarketingCampaignPage() {
  const navigate = useNavigate()

  return (
    <PageContainer>
      <MarketingCampaignStudio
        mode="create"
        onBack={() => navigate(routePaths.marketingCampaigns)}
      />
    </PageContainer>
  )
}
