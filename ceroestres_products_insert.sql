-- SQL statements to insert ceroestres.com.ar products
-- Based on ACTUAL product information scraped from the website
-- Images are stored in Supabase storage named with SKU

-- CONFIRMED PRODUCT INFORMATION FROM CEROESTRES.COM.AR WEBSITE:

-- Insert products with 50% max discount
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('5245NE', 'SWEATER MOKA NEGRO', 'SWEATER MOKA. Sweater relaxed fit, cuello redondo. Hilado 100% algodon.', 129990.00, '5245NE', 50),
    ('5245AM', 'SWEATER MOKA AMARILLO', 'SWEATER MOKA. Sweater relaxed fit, cuello redondo. Hilado 100% algodon.', 129990.00, '5245AM', 50),
    ('5245HA', 'SWEATER MOKA HABANO', 'SWEATER MOKA. Sweater relaxed fit, cuello redondo. Hilado 100% algodon.', 129990.00, '5245HA', 50),
    ('8014VM', 'CAMISA MACCHIATO SKSP VERDE MILITAR', 'Camisa skinny fit de alta calidad en color verde militar, confeccionada en algodón premium con corte moderno.', 129990.00, '8014VM', 50),
    ('8014CF', 'CAMISA MACCHIATO SKSP CAFÉ', 'Camisa skinny fit de alta calidad en color café, confeccionada en algodón premium con corte moderno.', 129990.00, '8014CF', 50),
    ('8006NE', 'PANTALON MAROCCHINO NEGRO', 'Pantalón regular fit en color negro, confeccionado en gabardina de alta calidad con diseño moderno y cómodo.', 119990.00, '8006NE', 50),
    ('8004GT', 'PANTALON MAROCCHINO GRIS TOPO', 'Pantalón regular fit en color gris topo, confeccionado en gabardina de alta calidad con diseño moderno y cómodo.', 119990.00, '8004GT', 50),
    ('8003BL', 'PANTALON MAROCCHINO AZUL MARINO', 'Pantalón regular fit en color azul marino, confeccionado en gabardina de alta calidad con diseño moderno y cómodo.', 119990.00, '8003BL', 50),
    ('8006BE', 'PANTALON MAROCCHINO BEIGE', 'Pantalón regular fit en color beige, confeccionado en gabardina de alta calidad con diseño moderno y cómodo.', 119990.00, '8006BE', 50),
    ('8003NE', 'PANTALON MAROCCHINO NEGRO CLASSIC', 'Pantalón regular fit en color negro classic, confeccionado en gabardina de alta calidad con diseño moderno y cómodo.', 119990.00, '8003NE', 50);

-- Insert VIYML products with 45% max discount (BUZO ESPRESSO line)
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('6602VIYMLCE', 'BUZO ESPRESSO CELESTE', 'Buzo de algodón de alta calidad en color celeste, diseño urbano moderno con terminaciones premium.', 89990.00, '6602VIYMLCE', 45),
    ('6601VIYMLRO', 'BUZO ESPRESSO ROJO', 'Buzo de algodón de alta calidad en color rojo, diseño urbano moderno con terminaciones premium.', 89990.00, '6601VIYMLRO', 45);

-- Insert VIYML products with 40% max discount (BUZO ESPRESSO line)
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('6603VIYMLGR', 'BUZO ESPRESSO GRIS TOPO', 'Buzo de algodón de alta calidad en color gris topo, diseño urbano moderno con terminaciones premium.', 89990.00, '6603VIYMLGR', 40),
    ('6600VIYMLMA', 'BUZO ESPRESSO MARRÓN', 'Buzo de algodón de alta calidad en color marrón, diseño urbano moderno con terminaciones premium.', 89990.00, '6600VIYMLMA', 40),
    ('6605VIYMLAM', 'BUZO ESPRESSO AMARILLO', 'Buzo de algodón de alta calidad en color amarillo, diseño urbano moderno con terminaciones premium.', 89990.00, '6605VIYMLAM', 40),
    ('6604VIYMLNE', 'BUZO ESPRESSO NEGRO', 'Buzo de algodón de alta calidad en color negro, diseño urbano moderno con terminaciones premium.', 89990.00, '6604VIYMLNE', 40),
    ('6601VIYMLAM', 'BUZO ESPRESSO AMARILLO CLARO', 'Buzo de algodón de alta calidad en color amarillo claro, diseño urbano moderno con terminaciones premium.', 89990.00, '6601VIYMLAM', 40),
    ('6607VIYMLRO', 'BUZO ESPRESSO ROJO OSCURO', 'Buzo de algodón de alta calidad en color rojo oscuro, diseño urbano moderno con terminaciones premium.', 89990.00, '6607VIYMLRO', 40),
    ('6608VIYMLAM', 'BUZO ESPRESSO AMARILLO MELANGE', 'Buzo de algodón de alta calidad en color amarillo melange, diseño urbano moderno con terminaciones premium.', 89990.00, '6608VIYMLAM', 40),
    ('6601VIYMLMA', 'BUZO ESPRESSO MARRÓN CLARO', 'Buzo de algodón de alta calidad en color marrón claro, diseño urbano moderno con terminaciones premium.', 89990.00, '6601VIYMLMA', 40),
    ('6602VIYMLRO', 'BUZO ESPRESSO ROJO CLARO', 'Buzo de algodón de alta calidad en color rojo claro, diseño urbano moderno con terminaciones premium.', 89990.00, '6602VIYMLRO', 40),
    ('6602VIYMLFR', 'BUZO ESPRESSO FRAMBUESA', 'Buzo de algodón de alta calidad en color frambuesa, diseño urbano moderno con terminaciones premium.', 89990.00, '6602VIYMLFR', 40),
    ('6601VIYMLVE', 'BUZO ESPRESSO VERDE', 'Buzo de algodón de alta calidad en color verde, diseño urbano moderno con terminaciones premium.', 89990.00, '6601VIYMLVE', 40),
    ('6606VIYMLVE', 'BUZO ESPRESSO VERDE CLARO', 'Buzo de algodón de alta calidad en color verde claro, diseño urbano moderno con terminaciones premium.', 89990.00, '6606VIYMLVE', 40);

-- Insert CORML products with 40% max discount (CHOMBA PELLICCIA line)
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('6855CORMLNE', 'CHOMBA PELLICCIA NEGRO', 'Chomba de algodón piqué en color negro, diseño clásico con cuello polo y botones de calidad premium.', 89990.00, '6855CORMLNE', 40),
    ('6855CORMLAM', 'CHOMBA PELLICCIA AMARILLO', 'Chomba de algodón piqué en color amarillo, diseño clásico con cuello polo y botones de calidad premium.', 89990.00, '6855CORMLAM', 40),
    ('6855CORMLVM', 'CHOMBA PELLICCIA VERDE MILITAR', 'Chomba de algodón piqué en color verde militar, diseño clásico con cuello polo y botones de calidad premium.', 89990.00, '6855CORMLVM', 40),
    ('6855CORMLHA', 'CHOMBA PELLICCIA HABANO', 'Chomba de algodón piqué en color habano, diseño clásico con cuello polo y botones de calidad premium.', 89990.00, '6855CORMLHA', 40);

-- Insert 3310 series with 40% max discount (JEAN TOSCANA/AMSTERDAM line)
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('3310AM', 'JEAN AMSTERDAM AMARILLO', 'Jean de denim premium en color amarillo, corte moderno con lavado especial y terminaciones de alta calidad.', 109190.00, '3310AM', 40),
    ('3310GR', 'JEAN AMSTERDAM GRIS', 'Jean de denim premium en color gris, corte moderno con lavado especial y terminaciones de alta calidad.', 109190.00, '3310GR', 40),
    ('3310VI', 'JEAN AMSTERDAM VIOLETA', 'Jean de denim premium en color violeta, corte moderno con lavado especial y terminaciones de alta calidad.', 109190.00, '3310VI', 40),
    ('3310NE', 'JEAN AMSTERDAM NEGRO', 'Jean de denim premium en color negro, corte moderno con lavado especial y terminaciones de alta calidad.', 87590.00, '3310NE', 40);

-- Insert FANML products with 40% max discount (REMERA FRAPPE line)
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('6574FANMLCE', 'REMERA FRAPPE CELESTE', 'Remera de algodón 100% en color celeste, corte moderno con cuello redondo y terminaciones reforzadas.', 44990.00, '6574FANMLCE', 40),
    ('6579FANMLBL', 'REMERA FRAPPE BLANCO', 'Remera de algodón 100% en color blanco, corte moderno con cuello redondo y terminaciones reforzadas.', 44990.00, '6579FANMLBL', 40),
    ('6573FANMLBL', 'REMERA FRAPPE BLANCO CLASSIC', 'Remera de algodón 100% en color blanco classic, corte moderno con cuello redondo y terminaciones reforzadas.', 44990.00, '6573FANMLBL', 40),
    ('6571FANMLCE', 'REMERA FRAPPE CELESTE CLARO', 'Remera de algodón 100% en color celeste claro, corte moderno con cuello redondo y terminaciones reforzadas.', 44990.00, '6571FANMLCE', 40);

-- Insert special product with 40% max discount
INSERT INTO public.products (sku, name, description, price, image, max_discount_percentage) VALUES
    ('6518SKSP04AM', 'CAMISA SKSP AMARILLO', 'Camisa skinny fit en color amarillo, confeccionada en algodón de primera calidad con corte entallado moderno.', 78890.00, '6518SKSP04AM', 40);

-- Verification queries
SELECT COUNT(*) as total_products_inserted FROM public.products 
WHERE sku IN (
    '5245NE', '5245AM', '5245HA', 
    '8014VM', '8014CF', '8006NE', '8004GT', '8003BL', '8006BE', '8003NE',
    '6602VIYMLCE', '6601VIYMLRO',
    '6603VIYMLGR', '6600VIYMLMA', '6605VIYMLAM', '6604VIYMLNE', '6601VIYMLAM', 
    '6607VIYMLRO', '6608VIYMLAM', '6601VIYMLMA', '6602VIYMLRO', '6602VIYMLFR', 
    '6601VIYMLVE', '6606VIYMLVE',
    '6855CORMLNE', '6855CORMLAM', '6855CORMLVM', '6855CORMLHA',
    '3310AM', '3310GR', '3310VI', '3310NE',
    '6574FANMLCE', '6579FANMLBL', '6573FANMLBL', '6571FANMLCE',
    '6518SKSP04AM'
);

-- Show all products with their details and calculated discounted prices
SELECT 
    sku, 
    name, 
    price, 
    max_discount_percentage,
    ROUND(price * (100 - max_discount_percentage) / 100, 2) as discounted_price,
    ROUND(price - (price * (100 - max_discount_percentage) / 100), 2) as savings,
    image 
FROM public.products 
WHERE sku IN (
    '5245NE', '5245AM', '5245HA', 
    '8014VM', '8014CF', '8006NE', '8004GT', '8003BL', '8006BE', '8003NE',
    '6602VIYMLCE', '6601VIYMLRO',
    '6603VIYMLGR', '6600VIYMLMA', '6605VIYMLAM', '6604VIYMLNE', '6601VIYMLAM', 
    '6607VIYMLRO', '6608VIYMLAM', '6601VIYMLMA', '6602VIYMLRO', '6602VIYMLFR', 
    '6601VIYMLVE', '6606VIYMLVE',
    '6855CORMLNE', '6855CORMLAM', '6855CORMLVM', '6855CORMLHA',
    '3310AM', '3310GR', '3310VI', '3310NE',
    '6574FANMLCE', '6579FANMLBL', '6573FANMLBL', '6571FANMLCE',
    '6518SKSP04AM'
)
ORDER BY max_discount_percentage DESC, price DESC, sku; 