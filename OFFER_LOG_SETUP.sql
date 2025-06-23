-- Create offer_logs table for tracking user offers
CREATE TABLE IF NOT EXISTS public.offer_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL, -- Session-based user tracking (since no login yet)
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    product_max_discount_percentage INTEGER NOT NULL,
    offered_amount DECIMAL(10,2) NOT NULL,
    offer_status TEXT NOT NULL CHECK (offer_status IN ('pending', 'accepted', 'rejected')),
    acceptance_code TEXT, -- Unique code if offer is accepted
    attempts_remaining INTEGER DEFAULT 3,
    is_redeemed BOOLEAN DEFAULT FALSE, -- For manual tracking of redemption
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Only set if accepted
    
    -- Foreign key reference to products table
    CONSTRAINT fk_product_sku FOREIGN KEY (product_sku) REFERENCES products(sku)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_offer_logs_session_id ON public.offer_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_offer_logs_product_sku ON public.offer_logs(product_sku);
CREATE INDEX IF NOT EXISTS idx_offer_logs_created_at ON public.offer_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_offer_logs_status ON public.offer_logs(offer_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.offer_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (since no authentication)
-- In production, you'd want more restrictive policies
CREATE POLICY "Allow all operations on offer_logs" ON public.offer_logs
    FOR ALL USING (true);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_offer_logs_updated_at
    BEFORE UPDATE ON public.offer_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.offer_logs TO anon;
GRANT ALL ON public.offer_logs TO authenticated; 