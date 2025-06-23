# Supabase Setup Guide

## 1. Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace `your_supabase_project_url` and `your_supabase_anon_key` with your actual Supabase project credentials.

## 2. Database Schema

Run the following SQL in your Supabase SQL Editor to create the products table:

```sql
-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image VARCHAR(500),
    max_discount_percentage INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on SKU for fast lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON public.products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access on products" 
    ON public.products FOR SELECT 
    USING (true);

-- Insert sample products based on the URLs you provided
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('5208GT', 'SWEATER GAEL GRIS TOPO', 'Sweater Escote redondo de punto Jersey con espaldín en tejido plano. Composición 60% Algodón 40% Poliester.', 89990, 'https://www.ceroestres.com.ar/productos/5208GT/', 30),
    ('5207NE', 'SWEATER GAEL PITUCON NEGRO', 'Sweater Escote redondo de punto Jersey con espaldín en tejido plano y pitucones. Composición 60% Algodón 40% Poliester.', 89990, 'https://www.ceroestres.com.ar/productos/5207NE/', 35);
```

## 3. How it Works

### Product Routes
- **Home**: `/` - Uses sample product for demo
- **Product Pages**: `/products/{SKU}` - Loads specific product from database
  - Example: `/products/5208GT` loads the gray sweater
  - Example: `/products/5207NE` loads the black sweater

### Database Integration
- **Real-time Updates**: Products automatically update when changed in the database
- **Dynamic Pricing**: Each product has its own `max_discount_percentage`
- **SKU-based Routing**: QR codes can link directly to `/products/{SKU}`

### Features Implemented

1. **Enhanced Product Interface**: Added `sku`, `description`, and `maxDiscountPercentage` fields
2. **Supabase Integration**: Full database connectivity with real-time updates
3. **Dynamic Routing**: `/products/:sku` route for individual products
4. **Error Handling**: Graceful handling of missing products or database errors
5. **Loading States**: Visual feedback during product loading
6. **Real-time Updates**: Product data automatically syncs with database changes

### Testing the Integration

1. Visit `/products/5208GT` to test the gray sweater
2. Visit `/products/5207NE` to test the black sweater
3. Use the camera simulation to test different products
4. Try accessing `/products/INVALID` to test error handling

### Next Steps

1. Add more products to the database using the same SQL pattern
2. Update product prices/discounts in Supabase to see real-time updates
3. Create QR codes that link to your product URLs
4. Deploy with proper environment variables 