import { supabase, Database } from './supabase'

export type OfferLog = Database['public']['Tables']['offer_logs']['Row']
export type OfferLogInsert = Database['public']['Tables']['offer_logs']['Insert']
export type OfferLogUpdate = Database['public']['Tables']['offer_logs']['Update']

// Session management utilities
const SESSION_KEY = 'shuq-session-id'
const ONBOARDING_SEEN_KEY = 'shuq-onboarding-seen'

export const getSessionId = (): string => {
  let sessionId = localStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem(SESSION_KEY, sessionId)
  }
  return sessionId
}

// Check if user has seen onboarding before
export const hasSeenOnboarding = (): boolean => {
  return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true'
}

// Mark onboarding as seen
export const markOnboardingSeen = (): void => {
  localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
}

// Generate unique acceptance code
export const generateAcceptanceCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Create a new offer log
export const createOfferLog = async (offerData: {
  product_sku: string
  product_name: string
  product_price: number
  product_max_discount_percentage: number
  offered_amount: number
  offer_status: 'pending' | 'accepted' | 'rejected'
  attempts_remaining?: number
}): Promise<OfferLog> => {
  const sessionId = getSessionId()
  
  const insertData: OfferLogInsert = {
    session_id: sessionId,
    product_sku: offerData.product_sku,
    product_name: offerData.product_name,
    product_price: offerData.product_price,
    product_max_discount_percentage: offerData.product_max_discount_percentage,
    offered_amount: offerData.offered_amount,
    offer_status: offerData.offer_status,
    attempts_remaining: offerData.attempts_remaining ?? 3,
    acceptance_code: offerData.offer_status === 'accepted' ? generateAcceptanceCode() : null,
    expires_at: offerData.offer_status === 'accepted' 
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
      : null
  }

  const { data, error } = await supabase
    .from('offer_logs')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating offer log:', error)
    throw error
  }

  return data
}

// Update an existing offer log
export const updateOfferLog = async (
  id: string, 
  updateData: OfferLogUpdate
): Promise<OfferLog> => {
  const { data, error } = await supabase
    .from('offer_logs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating offer log:', error)
    throw error
  }

  return data
}

// Get all offer logs for current session
export const getSessionOfferLogs = async (): Promise<OfferLog[]> => {
  const sessionId = getSessionId()

  const { data, error } = await supabase
    .from('offer_logs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching session offer logs:', error)
    throw error
  }

  return data || []
}

// Get offer logs for a specific product SKU in current session
export const getProductOfferLogs = async (productSku: string): Promise<OfferLog[]> => {
  const sessionId = getSessionId()

  const { data, error } = await supabase
    .from('offer_logs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('product_sku', productSku)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching product offer logs:', error)
    throw error
  }

  return data || []
}

// Get accepted offers (coupons) for current session
export const getAcceptedOffers = async (): Promise<OfferLog[]> => {
  const sessionId = getSessionId()

  const { data, error } = await supabase
    .from('offer_logs')
    .select('*')
    .eq('session_id', sessionId)
    .eq('offer_status', 'accepted')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching accepted offers:', error)
    throw error
  }

  return data || []
}

// Mark an offer as redeemed
export const markOfferAsRedeemed = async (offerId: string): Promise<OfferLog> => {
  return updateOfferLog(offerId, { is_redeemed: true })
}

// Check if an offer is expired
export const isOfferExpired = (offer: OfferLog): boolean => {
  if (!offer.expires_at) return false
  return new Date(offer.expires_at) < new Date()
}

// Get remaining attempts for a product in current session
export const getRemainingAttempts = async (productSku: string): Promise<number> => {
  const logs = await getProductOfferLogs(productSku)
  
  if (logs.length === 0) return 3 // Default attempts
  
  // Find the most recent offer for this product
  const mostRecentOffer = logs[0]
  
  // If the most recent offer was accepted, reset attempts for new offers
  if (mostRecentOffer.offer_status === 'accepted') return 3
  
  return Math.max(0, mostRecentOffer.attempts_remaining)
}

// Subscribe to offer log changes for current session
export const subscribeToSessionOfferLogs = (callback: (payload: any) => void) => {
  const sessionId = getSessionId()
  
  const subscription = supabase
    .channel('session_offer_logs')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'offer_logs',
        filter: `session_id=eq.${sessionId}`,
      },
      callback
    )
    .subscribe()

  return subscription
}

// Subscribe to all offer log changes (global, for admin updates)
export const subscribeToAllOfferLogs = (callback: (payload: any) => void) => {
  const subscription = supabase
    .channel('all_offer_logs')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'offer_logs',
      },
      callback
    )
    .subscribe()

  return subscription
}

// Unsubscribe from offer log changes
export const unsubscribeFromOfferLogs = (subscription: any) => {
  supabase.removeChannel(subscription)
}

// Transform offer log to coupon format (for backward compatibility)
export const transformOfferLogToCoupon = (offerLog: OfferLog) => ({
  id: offerLog.id,
  productName: offerLog.product_name,
  offeredPrice: offerLog.offered_amount,
  expiresAt: offerLog.expires_at ? new Date(offerLog.expires_at) : new Date(),
  type: 'accepted' as const,
  code: offerLog.acceptance_code || '',
  productImage: undefined, // We'll need to get this from products table if needed
  productSku: offerLog.product_sku, // Include SKU for image fallback
  isRedeemed: offerLog.is_redeemed,
  status: offerLog.is_redeemed ? 'usado' : 'pendiente' as 'pendiente' | 'usado' | 'cancelado',
  createdAt: new Date(offerLog.created_at)
})

// Admin functions - get all offer logs (no session filter)
export const getAllOfferLogs = async (): Promise<OfferLog[]> => {
  const { data, error } = await supabase
    .from('offer_logs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching all offer logs:', error)
    throw error
  }

  return data || []
}

// Get offer summary by SKU
export interface OfferSummary {
  product_sku: string
  product_name: string
  product_price: number
  total_offers: number
  accepted_offers: number
  rejected_offers: number
  acceptance_rate: number
  average_offered_price: number
}

export const getOfferSummaryBySku = async (): Promise<OfferSummary[]> => {
  const { data, error } = await supabase
    .from('offer_logs')
    .select('product_sku, product_name, product_price, offer_status, offered_amount')

  if (error) {
    console.error('Error fetching offer summary:', error)
    throw error
  }

  if (!data) return []

  // Group by SKU and calculate summary
  const summaryMap = new Map<string, { 
    summary: OfferSummary, 
    offeredAmounts: number[] 
  }>()

  data.forEach(log => {
    const sku = log.product_sku
    if (!summaryMap.has(sku)) {
      summaryMap.set(sku, {
        summary: {
          product_sku: sku,
          product_name: log.product_name,
          product_price: log.product_price,
          total_offers: 0,
          accepted_offers: 0,
          rejected_offers: 0,
          acceptance_rate: 0,
          average_offered_price: 0
        },
        offeredAmounts: []
      })
    }

    const entry = summaryMap.get(sku)!
    entry.summary.total_offers++
    entry.offeredAmounts.push(log.offered_amount)
    
    if (log.offer_status === 'accepted') {
      entry.summary.accepted_offers++
    } else if (log.offer_status === 'rejected') {
      entry.summary.rejected_offers++
    }
  })

  // Calculate acceptance rates and average offered prices
  const summaries = Array.from(summaryMap.values()).map(entry => {
    const summary = entry.summary
    summary.acceptance_rate = summary.total_offers > 0 
      ? Math.round((summary.accepted_offers / summary.total_offers) * 100)
      : 0
    
    // Calculate average offered price
    summary.average_offered_price = entry.offeredAmounts.length > 0
      ? Math.round(entry.offeredAmounts.reduce((sum, amount) => sum + amount, 0) / entry.offeredAmounts.length)
      : 0
    
    return summary
  })

  return summaries.sort((a, b) => b.total_offers - a.total_offers)
}