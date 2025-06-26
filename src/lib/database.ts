import { supabase, Database } from './supabase'

export type Product = Database['public']['Tables']['products']['Row']
export type ProductInsert = Database['public']['Tables']['products']['Insert']
export type ProductUpdate = Database['public']['Tables']['products']['Update']

// Helper function to get correct Supabase storage URL
// Try different image formats in order of preference
export const getSupabaseImageUrl = (sku: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  // Priority order: webp (modern format), jpg (common), png (fallback)
  return `${supabaseUrl}/storage/v1/object/public/products/${sku}.webp`
}

// Helper function to get fallback image URLs for different formats
export const getImageUrls = (sku: string) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  return [
    `${supabaseUrl}/storage/v1/object/public/products/${sku}.webp`,
    `${supabaseUrl}/storage/v1/object/public/products/${sku}.jpg`,
    `${supabaseUrl}/storage/v1/object/public/products/${sku}.png`
  ]
}

// Transform database product to app product format
export const transformProduct = (dbProduct: Product): {
  id: string
  sku: string
  name: string
  description: string
  price: number
  image: string
  maxDiscountPercentage: number
} => ({
  id: dbProduct.id,
  sku: dbProduct.sku,
  name: dbProduct.name,
  description: dbProduct.description,
  price: dbProduct.price,
  image: getSupabaseImageUrl(dbProduct.sku), // Use helper function to generate correct URL
  maxDiscountPercentage: dbProduct.max_discount_percentage,
})

// Get all products
export const getAllProducts = async () => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching products:', error)
    throw error
  }

  return data?.map(transformProduct) || []
}

// Get product by SKU
export const getProductBySku = async (sku: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Error fetching product:', error)
    throw error
  }

  return data ? transformProduct(data) : null
}

// Get product by ID
export const getProductById = async (id: string) => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Error fetching product:', error)
    throw error
  }

  return data ? transformProduct(data) : null
}

// Subscribe to product changes
export const subscribeToProductChanges = (callback: (product: any) => void) => {
  const subscription = supabase
    .channel('products')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'products',
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()

  return subscription
}

// Unsubscribe from product changes
export const unsubscribeFromProductChanges = (subscription: any) => {
  supabase.removeChannel(subscription)
} 