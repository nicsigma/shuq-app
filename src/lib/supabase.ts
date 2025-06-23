import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database types
export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          sku: string
          name: string
          description: string
          price: number
          image: string
          max_discount_percentage: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sku: string
          name: string
          description: string
          price: number
          image: string
          max_discount_percentage: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          description?: string
          price?: number
          image?: string
          max_discount_percentage?: number
          created_at?: string
          updated_at?: string
        }
      }
      offer_logs: {
        Row: {
          id: string
          session_id: string
          product_sku: string
          product_name: string
          product_price: number
          product_max_discount_percentage: number
          offered_amount: number
          offer_status: 'pending' | 'accepted' | 'rejected'
          acceptance_code: string | null
          attempts_remaining: number
          is_redeemed: boolean
          created_at: string
          updated_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          session_id: string
          product_sku: string
          product_name: string
          product_price: number
          product_max_discount_percentage: number
          offered_amount: number
          offer_status: 'pending' | 'accepted' | 'rejected'
          acceptance_code?: string | null
          attempts_remaining?: number
          is_redeemed?: boolean
          created_at?: string
          updated_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          product_sku?: string
          product_name?: string
          product_price?: number
          product_max_discount_percentage?: number
          offered_amount?: number
          offer_status?: 'pending' | 'accepted' | 'rejected'
          acceptance_code?: string | null
          attempts_remaining?: number
          is_redeemed?: boolean
          created_at?: string
          updated_at?: string
          expires_at?: string | null
        }
      }
    }
  }
} 