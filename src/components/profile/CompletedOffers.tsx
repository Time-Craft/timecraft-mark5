
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { CheckCircle2, BadgeCheck } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

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
  username?: string
  claimed?: boolean
  hours?: number
  transaction_id?: string
  isOwner?: boolean 
}

const CompletedOffers = ({ userId, username, avatar }: CompletedOffersProps) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [claimedTransactions, setClaimedTransactions] = useState<string[]>([])
  
  const claimCreditsMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      console.log("Claiming credits for transaction:", transactionId)
      const { data, error } = await supabase
        .from('transactions')
        .update({ claimed: true })
        .eq('id', transactionId)
        .select()
        .single()
      
      if (error) {
        console.error("Error claiming credits:", error)
        throw error
      }
      console.log("Successfully claimed credits, transaction updated:", data)
      return data
    },
    onSuccess: (data, transactionId) => {
      toast({
        title: "Credits claimed successfully",
        description: "The time credits have been added to your balance",
        variant: "default",
      })
      
      setClaimedTransactions(prev => [...prev, transactionId])
      
      queryClient.invalidateQueries({ queryKey: ['completed-offers'] })
      queryClient.invalidateQueries({ queryKey: ['time-balance'] })
      queryClient.invalidateQueries({ queryKey: ['time-balance', userId] })
      queryClient.invalidateQueries({ queryKey: ['user-stats'] })
    },
    onError: (error) => {
      console.error("Error claiming credits:", error)
      toast({
        title: "Failed to claim credits",
        description: error.message,
        variant: "destructive",
      })
    }
  })
  
  const { data: completedOffers, isLoading } = useQuery({
    queryKey: ['completed-offers', userId],
    queryFn: async () => {
      if (!userId) return []
      
      console.log("Fetching all completed services for user:", userId)
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          service,
          hours,
          created_at,
          offer_id,
          user_id,
          provider_id,
          claimed
        `)
        .or(`provider_id.eq.${userId},user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching completed offers:', error)
        throw error
      }

      console.log("Found transactions:", data?.length || 0)

      const completedOffers = []
      const processedOfferIds = new Set()

      for (const transaction of data || []) {
        if (processedOfferIds.has(transaction.offer_id)) {
          console.log('Skipping duplicate offer:', transaction.offer_id)
          continue
        }
        
        const { data: offerData, error: offerError } = await supabase
          .from('offers')
          .select('title, description, service_type, time_credits, profile_id')
          .eq('id', transaction.offer_id)
          .maybeSingle()
          
        if (offerError) {
          console.warn(`Error fetching offer ${transaction.offer_id}:`, offerError)
          continue
        }
        
        if (!offerData?.title || !offerData?.description) {
          console.log('Skipping offer with missing data:', transaction.offer_id)
          continue
        }
        
        processedOfferIds.add(transaction.offer_id)
        
        const isOwner = offerData?.profile_id === userId;
        
        const otherUserId = isOwner ? transaction.provider_id : transaction.user_id;
        
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', otherUserId)
          .maybeSingle()
          
        if (userError) {
          console.warn(`Error fetching user ${otherUserId}:`, userError)
        }

        if (!userData?.username) {
          console.log('Skipping offer with missing username data:', transaction.offer_id)
          continue
        }

        completedOffers.push({
          id: transaction.offer_id,
          transaction_id: transaction.id,
          title: offerData?.title,
          description: offerData?.description,
          service_type: offerData?.service_type || transaction.service,
          time_credits: offerData?.time_credits || transaction.hours || 0,
          hours: transaction.hours,
          created_at: transaction.created_at,
          completed_at: transaction.created_at,
          username: userData?.username,
          claimed: transaction.claimed,
          isOwner: isOwner
        })
      }

      console.log("Processed completed offers:", completedOffers.length)
      return completedOffers
    },
    enabled: !!userId
  })

  const handleClaimCredits = async (transactionId: string) => {
    try {
      console.log("Attempting to claim credits for transaction:", transactionId)
      await claimCreditsMutation.mutate(transactionId)
    } catch (error) {
      console.error('Error claiming credits:', error)
    }
  }

  // Properly filter the offers based on isOwner property
  const completedByMe = completedOffers?.filter(offer => !offer.isOwner) || []
  const completedForMe = completedOffers?.filter(offer => offer.isOwner) || []

  return (
    <div className="space-y-4">
      <Tabs defaultValue="completed-by-me" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="completed-by-me">Completed by Me</TabsTrigger>
          <TabsTrigger value="completed-for-me">Completed for Me</TabsTrigger>
        </TabsList>
        
        <TabsContent value="completed-by-me">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : completedByMe.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No completed exchanges found
            </p>
          ) : (
            completedByMe.map((offer) => (
              <CompletedOfferCard
                key={`offer-${offer.transaction_id}`}
                offer={offer}
                onClaimCredits={handleClaimCredits}
                isClaimingCredits={claimCreditsMutation.isPending}
                isClaimedLocally={claimedTransactions.includes(offer.transaction_id || '')}
              />
            ))
          )}
        </TabsContent>
        
        <TabsContent value="completed-for-me">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : completedForMe.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No completed exchanges found
            </p>
          ) : (
            completedForMe.map((offer) => (
              <CompletedOfferCard
                key={`offer-${offer.transaction_id}`}
                offer={offer}
                onClaimCredits={handleClaimCredits}
                isClaimingCredits={claimCreditsMutation.isPending}
                isClaimedLocally={claimedTransactions.includes(offer.transaction_id || '')}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

const CompletedOfferCard = ({ 
  offer, 
  onClaimCredits,
  isClaimingCredits,
  isClaimedLocally
}: { 
  offer: CompletedOffer, 
  onClaimCredits?: (transactionId: string) => void,
  isClaimingCredits?: boolean,
  isClaimedLocally?: boolean
}) => {
  const isClaimed = offer.claimed || isClaimedLocally;
  
  const showClaimButton = !offer.isOwner && !isClaimed && onClaimCredits && offer.transaction_id;

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
            {isClaimed ? "Claimed" : "Completed"}
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
        
        <div className="mt-4 pt-3 border-t border-navy/10 text-sm flex justify-between items-center">
          <div>
            {offer.isOwner ? (
              <p>Completed by: <span className="font-medium">{offer.username}</span></p>
            ) : (
              <p>Requested by: <span className="font-medium">{offer.username}</span></p>
            )}
          </div>
          
          {showClaimButton && (
            <Button 
              onClick={() => onClaimCredits?.(offer.transaction_id!)} 
              disabled={isClaimingCredits}
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <BadgeCheck className="h-4 w-4 mr-2" />
              Claim {offer.hours} Credits
            </Button>
          )}
          
          {!offer.isOwner && isClaimed && (
            <div className="flex items-center text-green-700 font-medium text-sm">
              <BadgeCheck className="h-4 w-4 mr-1" />
              Credits Claimed
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default CompletedOffers
