
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, ChartBar, List } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

const QuickStats = () => {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  
  // First fetch the user ID
  useEffect(() => {
    const fetchUserId = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user?.id) {
        setUserId(data.user.id)
      }
    }
    
    fetchUserId()
  }, [])

  // Set up real-time listeners only when we have a user ID
  useEffect(() => {
    if (!userId) return
    
    // Set up real-time listener for time balances changes
    const timeBalanceChannel = supabase
      .channel('time-balance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_balances',
          filter: `user_id=eq.${userId}`
        },
        () => {
          console.log('Time balance update received')
          queryClient.invalidateQueries({ queryKey: ['time-balance', userId] })
        }
      )
      .subscribe()

    // Set up real-time listener for offers changes to update stats
    const offersChannel = supabase
      .channel('offers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'offers',
          filter: `profile_id=eq.${userId}`
        },
        () => {
          console.log('Offers update received')
          queryClient.invalidateQueries({ queryKey: ['user-stats', userId] })
          queryClient.invalidateQueries({ queryKey: ['time-balance', userId] })
          queryClient.invalidateQueries({ queryKey: ['user-offers', userId] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(timeBalanceChannel)
      supabase.removeChannel(offersChannel)
    }
  }, [queryClient, userId])

  // Get user stats from the database
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats', userId],
    queryFn: async () => {
      if (!userId) return null
      
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!userId // Only run query when userId is available
  })

  // Get user's offers to calculate credits used
  const { data: userOffers, isLoading: userOffersLoading } = useQuery({
    queryKey: ['user-offers', userId],
    queryFn: async () => {
      if (!userId) return null
      
      const { data, error } = await supabase
        .from('offers')
        .select('time_credits')
        .eq('profile_id', userId)
      
      if (error) throw error
      return data
    },
    enabled: !!userId
  })

  // Calculate available time balance based on offers
  const calculateTimeBalance = () => {
    const INITIAL_CREDITS = 30;
    
    if (userOffersLoading || !userOffers) {
      return INITIAL_CREDITS;
    }
    
    // Sum up all credits used in offers
    const usedCredits = userOffers.reduce((sum, offer) => 
      sum + (offer.time_credits || 0), 0);
    
    return INITIAL_CREDITS - usedCredits;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="gradient-border card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-navy">Time Balance</CardTitle>
          <Clock className="h-4 w-4 text-teal" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-navy">
              {userOffersLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                `${calculateTimeBalance()} credits`
              )}
            </div>
            <Badge variant="outline" className="bg-teal/10 text-teal">Available</Badge>
          </div>
        </CardContent>
      </Card>
      
      <Card className="gradient-border card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-navy">Active Requests</CardTitle>
          <List className="h-4 w-4 text-teal" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-navy">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              stats?.active_offers || 0
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card className="gradient-border card-hover">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-navy">Hours Exchanged</CardTitle>
          <ChartBar className="h-4 w-4 text-teal" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-navy">
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              stats?.hours_exchanged || 0
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default QuickStats
