import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import OfferHeader from "./OfferHeader"
import { Check, Hourglass, X, Trash2 } from "lucide-react"
import { useApplicationManagement } from "@/hooks/useApplicationManagement"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/components/ui/use-toast"
import { useOfferManagement } from "@/hooks/useOfferManagement"

interface OfferCardProps {
  offer: {
    id: string
    title: string
    description: string
    hours: number
    timeCredits?: number
    user: {
      id: string
      name: string
      avatar: string
    }
    status: string
    service_type?: string
    accepted_by?: string[]
    isApplied?: boolean
    applicationStatus?: string
  }
  showApplications?: boolean
}

const OfferCard = ({ offer, showApplications = false }: OfferCardProps) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { deleteOffer, isDeleting } = useOfferManagement()
  const { 
    applyToOffer, 
    applications, 
    updateApplicationStatus,
    userApplication,
    isApplying,
    isUpdating
  } = useApplicationManagement(offer.id)

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error
      return user
    }
  })

  const isOwner = currentUser?.id === offer.user.id

  const handleDelete = async () => {
    try {
      await deleteOffer(offer.id)
      
      // Optimistically remove the offer from both queries
      queryClient.setQueryData(['offers'], (old: any) => 
        old?.filter((o: any) => o.id !== offer.id) || []
      )
      queryClient.setQueryData(['user-offers'], (old: any) => 
        old?.filter((o: any) => o.id !== offer.id) || []
      )

      toast({
        title: "Success",
        description: "Offer deleted successfully",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete offer: " + error.message,
      })
    }
  }

  const renderApplyButton = () => {
    // If this is an offer the user has already applied to (coming from the applications list)
    if (offer.isApplied) {
      const statusColorClass = offer.applicationStatus === 'pending' 
        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
        : offer.applicationStatus === 'accepted'
          ? 'bg-green-100 text-green-800 border-green-300'
          : 'bg-red-100 text-red-800 border-red-300';
        
      return (
        <Button 
          disabled 
          variant="secondary"
          className={`w-full md:w-auto mt-4 md:mt-0 ${statusColorClass}`}
        >
          <Hourglass className="h-4 w-4 mr-1" />
          {offer.applicationStatus === 'pending' ? 'Application Pending' : 
            offer.applicationStatus === 'accepted' ? 'Application Accepted' : 
            'Application Rejected'}
        </Button>
      );
    }

    // For regular offers that the user might want to apply to
    if (userApplication) {
      const statusColorClass = userApplication.status === 'pending' 
        ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
        : userApplication.status === 'accepted'
          ? 'bg-green-100 text-green-800 border-green-300'
          : 'bg-red-100 text-red-800 border-red-300';

      return (
        <Button 
          disabled 
          variant="secondary"
          className={`w-full md:w-auto mt-4 md:mt-0 ${statusColorClass}`}
        >
          <Hourglass className="h-4 w-4 mr-1" />
          {userApplication.status === 'pending' ? 'Application Pending' : 
            userApplication.status === 'accepted' ? 'Application Accepted' : 
            'Application Rejected'}
        </Button>
      )
    }

    return (
      <Button 
        onClick={() => applyToOffer(offer.id)}
        disabled={offer.status !== 'available' || isApplying}
        className="w-full md:w-auto mt-4 md:mt-0 bg-teal hover:bg-teal/90 text-cream"
      >
        <Check className="h-4 w-4 mr-1" />
        {offer.status === 'available' ? 'Apply' : 'Not Available'}
      </Button>
    )
  }

  return (
    <Card className="gradient-border card-hover">
      <CardContent className="p-6">
        <OfferHeader 
          user={offer.user} 
          title={offer.title} 
          hours={offer.hours}
          timeCredits={offer.timeCredits} 
        />
        <p className="mt-2 text-navy/80">{offer.description}</p>
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            {isOwner && (
              <Button
                onClick={handleDelete}
                variant="destructive"
                disabled={isDeleting}
                className="w-full md:w-auto flex items-center justify-center"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            {!isOwner && renderApplyButton()}
          </div>
        </div>

        {showApplications && applications && applications.length > 0 && (
          <div className="mt-4 border-t border-mint/20 pt-4">
            <h4 className="font-semibold mb-2 text-navy">Applications</h4>
            <div className="space-y-2">
              {applications.map((application: any) => (
                <div key={application.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-mint/10 p-3 rounded-lg">
                  <span className="text-navy">{application.profiles.username}</span>
                  {application.status === 'pending' && (
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="default"
                        onClick={() => updateApplicationStatus({ 
                          applicationId: application.id, 
                          status: 'accepted' 
                        })}
                        disabled={isUpdating}
                        className="bg-teal hover:bg-teal/90 text-cream"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => updateApplicationStatus({ 
                          applicationId: application.id, 
                          status: 'rejected' 
                        })}
                        disabled={isUpdating}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {application.status !== 'pending' && (
                    <span className={`capitalize ${
                      application.status === 'accepted' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {application.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default OfferCard
