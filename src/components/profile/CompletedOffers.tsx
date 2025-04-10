
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2, User, Users } from "lucide-react"

interface CompletedOffersProps {
  userId: string | null
  username?: string
  avatar?: string
}

interface CompletedOffer {
  id: string
  title: string
  description: string
  service_type: string
  time_credits: number
  created_at: string
  completed_at: string
  provider_username?: string
  requester_username?: string
}

const CompletedOffers = ({ userId, username, avatar }: CompletedOffersProps) => {
  const [activeTab, setActiveTab] = useState<'by-you' | 'for-you'>('for-you')
  
  // Fetch offers completed BY the user (user was the service provider)
  const { data: completedByYou, isLoading: byYouLoading } = useQuery({
    queryKey: ['completed-offers', userId, 'by-you'],
    queryFn: async () => {
      if (!userId) return []
      
      // Get transactions where the user was the provider
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          service,
          hours,
          created_at,
          offer_id,
          user_id
        `)
        .eq('provider_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching completed offers by you:', error)
        throw error
      }

      // For each transaction, get the offer details
      const completedOffers = []
      
      for (const transaction of data) {
        // Get offer details
        const { data: offerData, error: offerError } = await supabase
          .from('offers')
          .select('title, description, service_type, time_credits')
          .eq('id', transaction.offer_id)
          .single()
          
        if (offerError) {
          console.warn(`Error fetching offer ${transaction.offer_id}:`, offerError)
          continue
        }
        
        // Get requester username
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', transaction.user_id)
          .single()
          
        if (userError) {
          console.warn(`Error fetching user ${transaction.user_id}:`, userError)
        }

        completedOffers.push({
          id: transaction.id,
          title: offerData?.title || 'Unknown Title',
          description: offerData?.description || 'No description available',
          service_type: transaction.service,
          time_credits: offerData?.time_credits || 0,
          hours: transaction.hours,
          created_at: transaction.created_at,
          completed_at: transaction.created_at, // Using created_at as completed_at
          requester_username: userData?.username || 'Unknown User'
        })
      }

      return completedOffers
    },
    enabled: !!userId
  })
  
  // Fetch offers completed FOR the user (user made the request)
  const { data: completedForYou, isLoading: forYouLoading } = useQuery({
    queryKey: ['completed-offers', userId, 'for-you'],
    queryFn: async () => {
      if (!userId) return []
      
      // Get transactions where user requested the service
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          service,
          hours,
          created_at,
          provider_id,
          offer_id
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching completed offers for you:', error)
        throw error
      }

      // For each transaction, get the offer details
      const completedOffers = []
      
      for (const transaction of data) {
        // Get offer details
        const { data: offerData, error: offerError } = await supabase
          .from('offers')
          .select('title, description, service_type, time_credits')
          .eq('id', transaction.offer_id)
          .single()
          
        if (offerError) {
          console.warn(`Error fetching offer ${transaction.offer_id}:`, offerError)
          continue
        }
        
        // Get provider username
        const { data: providerData, error: providerError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', transaction.provider_id)
          .single()
          
        if (providerError) {
          console.warn(`Error fetching provider ${transaction.provider_id}:`, providerError)
        }

        completedOffers.push({
          id: transaction.id,
          title: offerData?.title || 'Unknown Title',
          description: offerData?.description || 'No description available',
          service_type: transaction.service,
          time_credits: offerData?.time_credits || 0,
          hours: transaction.hours,
          created_at: transaction.created_at,
          completed_at: transaction.created_at, // Using created_at as completed_at
          provider_username: providerData?.username || 'Unknown Provider'
        })
      }

      return completedOffers
    },
    enabled: !!userId
  })

  return (
    <div>
      <Tabs defaultValue="for-you" onValueChange={(val) => setActiveTab(val as 'by-you' | 'for-you')}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="for-you" className="flex items-center">
            <User className="h-4 w-4 mr-2" />
            FOR YOU
          </TabsTrigger>
          <TabsTrigger value="by-you" className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            BY YOU
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="for-you">
          <div className="space-y-4">
            {forYouLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            ) : completedForYou?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No services have been completed for you yet
              </p>
            ) : (
              completedForYou?.map((offer) => (
                <CompletedOfferCard
                  key={offer.id}
                  offer={offer}
                  isForYou={true}
                />
              ))
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="by-you">
          <div className="space-y-4">
            {byYouLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-36 w-full" />
              </div>
            ) : completedByYou?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                You haven't completed any services yet
              </p>
            ) : (
              completedByYou?.map((offer) => (
                <CompletedOfferCard
                  key={offer.id}
                  offer={offer}
                  isForYou={false}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Component for displaying a completed offer card
const CompletedOfferCard = ({ 
  offer, 
  isForYou 
}: { 
  offer: CompletedOffer, 
  isForYou: boolean 
}) => {
  return (
    <Card className="gradient-border">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg text-navy">{offer.title}</h3>
            <p className="text-sm text-navy/80">{offer.description}</p>
          </div>
          <div className="flex items-center text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="bg-mint/10 text-navy px-3 py-1 rounded-full text-xs">
            {offer.service_type}
          </div>
          <div className="bg-teal/10 text-teal px-3 py-1 rounded-full text-xs">
            {offer.time_credits} credits
          </div>
          <div className="bg-navy/10 text-navy px-3 py-1 rounded-full text-xs">
            {new Date(offer.created_at).toLocaleDateString()}
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-navy/10 text-sm">
          {isForYou ? (
            <p>Completed by: <span className="font-medium">{offer.provider_username}</span></p>
          ) : (
            <p>Requested by: <span className="font-medium">{offer.requester_username}</span></p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default CompletedOffers
