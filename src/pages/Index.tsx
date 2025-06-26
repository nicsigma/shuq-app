import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ShoppingBag, Clock, CheckCircle, Menu, Camera, Receipt, Percent } from 'lucide-react';
import { ConfirmExitDialog } from '@/components/ConfirmExitDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getProductBySku, getAllProducts, subscribeToProductChanges, unsubscribeFromProductChanges, getImageUrls } from '@/lib/database';
import { 
  createOfferLog, 
  getAcceptedOffers, 
  getRemainingAttempts, 
  subscribeToSessionOfferLogs, 
  unsubscribeFromOfferLogs,
  transformOfferLogToCoupon,
  isOfferExpired,
  hasSeenOnboarding,
  markOnboardingSeen,
  OfferLog
} from '@/lib/offerLogs';
import { BrowserMultiFormatReader } from '@zxing/library';

// Enhanced image component with multiple format fallback
const ProductImage = ({ src, alt, className, sku }: { src: string; alt: string; className: string; sku?: string }) => {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (sku) {
      const urls = getImageUrls(sku);
      setImageUrls(urls);
      setCurrentSrc(urls[0]);
      setCurrentIndex(0);
    } else {
      setCurrentSrc(src);
      setImageUrls([src]);
      setCurrentIndex(0);
    }
    setHasError(false);
  }, [src, sku]);

  const handleError = () => {
    if (currentIndex < imageUrls.length - 1) {
      // Try next format
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setCurrentSrc(imageUrls[nextIndex]);
    } else {
      // All formats failed, show placeholder
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"></path>
        </svg>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
};

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  image: string;
  maxDiscountPercentage: number; // Max acceptable discount (hidden from user)
}

interface Coupon {
  id: string;
  productName: string;
  offeredPrice: number;
  expiresAt: Date;
  type: 'accepted' | 'special-discount';
  code: string;
  discountPercentage?: number; // For special discount coupons
  productImage?: string; // Store product image URL
  productSku?: string; // Product SKU for image fallback
}



const ShuQApp = () => {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQRSimulation = searchParams.get('qr') === 'true';
  
  const [currentScreen, setCurrentScreen] = useState<'loader' | 'onboarding' | 'offer' | 'result' | 'coupons' | 'camera' | 'products' | 'productsList'>('loader');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState<boolean>(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState<number>(75000);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [lastOfferResult, setLastOfferResult] = useState<'accepted' | 'rejected' | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showExitDialog, setShowExitDialog] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // QR Scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Reset state when route changes and load product(s) from database
  useEffect(() => {
    // Reset state when route changes
    setCurrentScreen('loader');
    setSelectedProduct(null);
    setAllProducts([]);
    setProductError(null);
    setOfferPrice(75000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    
    const loadData = async () => {
      if (sku) {
        // Load specific product by SKU
        setIsLoadingProduct(true);
        setProductError(null);
        
        try {
          const product = await getProductBySku(sku);
          
          if (product) {
            setSelectedProduct(product);
            setOfferPrice(product.price); // Set initial offer to max price
          } else {
            setProductError('Producto no encontrado');
            navigate('/'); // Redirect to home if product not found
          }
        } catch (error) {
          console.error('Error loading product:', error);
          setProductError('Error al cargar el producto');
        } finally {
          setIsLoadingProduct(false);
        }
      } else {
        // No SKU provided, load all products for home page
        setIsLoadingProduct(true);
        setProductError(null);
        
        try {
          const products = await getAllProducts();
          setAllProducts(products);
          
          if (products.length === 0) {
            setProductError('No se encontraron productos');
          }
        } catch (error) {
          console.error('Error loading products:', error);
          setProductError('Error al cargar los productos');
        } finally {
          setIsLoadingProduct(false);
        }
      }
    };

    loadData();
  }, [sku, navigate]);

  // Auto-transition from loader
  useEffect(() => {
    if (currentScreen === 'loader' && !isLoadingProduct) {
      // Determine timing based on user type
      const isFirstTime = sku && selectedProduct && !hasSeenOnboarding();
      const loaderTime = isFirstTime ? 3000 : 1500; // 3s for first-time, 1.5s for returning users
      
      const timer = setTimeout(() => {
        if (sku && selectedProduct) {
          // Product page - check if first-time user
          if (hasSeenOnboarding()) {
            // Returning user - go directly to offer
            setCurrentScreen('offer');
          } else {
            // First-time user - show onboarding
            setCurrentScreen('onboarding');
          }
        } else if (!sku && allProducts.length > 0) {
          // Home page - go to products list
          setCurrentScreen('products');
        }
      }, loaderTime);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, selectedProduct, allProducts, isLoadingProduct, sku]);

  // Removed auto-advance from onboarding - users must click "Comenzar" to proceed

  // Subscribe to product changes for real-time updates
  useEffect(() => {
    if (selectedProduct) {
      const subscription = subscribeToProductChanges((payload) => {
        if (payload.eventType === 'UPDATE' && payload.new.sku === selectedProduct.sku) {
          // Transform the database product format to app format
          const updatedProduct = {
            id: payload.new.id,
            sku: payload.new.sku,
            name: payload.new.name,
            description: payload.new.description,
            price: payload.new.price,
            image: payload.new.image,
            maxDiscountPercentage: payload.new.max_discount_percentage,
          };
          setSelectedProduct(updatedProduct);
        }
      });

      return () => {
        unsubscribeFromProductChanges(subscription);
      };
    }
  }, [selectedProduct]);

  // Load attempts remaining from database and subscribe to offer log updates
  useEffect(() => {
    if (selectedProduct) {
      // Only load attempts from database if we're continuing an existing offer session
      // If this is a fresh start (no lastOfferResult), reset to 3 attempts
      if (lastOfferResult === null) {
        setAttemptsRemaining(3);
      } else {
        // Load remaining attempts from database only if we're in the middle of an offer flow
        const loadAttempts = async () => {
          try {
            const remaining = await getRemainingAttempts(selectedProduct.sku);
            setAttemptsRemaining(remaining);
          } catch (error) {
            console.error('Error loading attempts:', error);
          }
        };

        loadAttempts();
      }

      // Subscribe to offer log changes
      const subscription = subscribeToSessionOfferLogs((payload) => {
        if (payload.new && payload.new.product_sku === selectedProduct.sku) {
          // Update attempts remaining if this is a new offer for this product
          if (payload.eventType === 'INSERT') {
            setAttemptsRemaining(payload.new.attempts_remaining);
          }
        }
      });

      return () => {
        unsubscribeFromOfferLogs(subscription);
      };
    }
  }, [selectedProduct]);

  // Load accepted offers from database on component mount
  useEffect(() => {
    const loadAcceptedOffers = async () => {
      try {
        const acceptedOffers = await getAcceptedOffers();
        const transformedCoupons = acceptedOffers
          .filter(offer => !isOfferExpired(offer))
          .map(offer => ({
            ...transformOfferLogToCoupon(offer),
            productImage: offer.product_sku ? `/api/products/${offer.product_sku}/image` : undefined
          }));
        
        // Merge with existing localStorage coupons if any
        const savedCoupons = localStorage.getItem('shuq-coupons');
        const localCoupons = savedCoupons ? JSON.parse(savedCoupons).map((coupon: any) => ({
          ...coupon,
          expiresAt: new Date(coupon.expiresAt)
        })) : [];
        
        // Remove duplicates and combine
        const allCoupons = [...transformedCoupons, ...localCoupons.filter(
          (localCoupon: any) => !transformedCoupons.some(dbCoupon => dbCoupon.id === localCoupon.id)
        )];
        
        setCoupons(allCoupons);
      } catch (error) {
        console.error('Error loading accepted offers:', error);
      }
    };

    loadAcceptedOffers();
  }, []);

  const saveCoupons = (newCoupons: Coupon[]) => {
    setCoupons(newCoupons);
    localStorage.setItem('shuq-coupons', JSON.stringify(newCoupons));
  };

  const generateCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  const getAttemptColor = () => {
    if (attemptsRemaining === 3) return 'text-green-600';
    if (attemptsRemaining === 2) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getAttemptText = () => {
    if (attemptsRemaining === 1) return 'Tenés 1 intento';
    return `Tenés ${attemptsRemaining} intentos`;
  };

  const handleSendOffer = async () => {
    if (!selectedProduct) return;
    
    const minAcceptablePrice = selectedProduct.price * (1 - selectedProduct.maxDiscountPercentage / 100);
    const isAccepted = offerPrice >= minAcceptablePrice;
    const newAttempts = isAccepted ? attemptsRemaining : attemptsRemaining - 1;
    
    try {
      // Create offer log in database
      const offerLog = await createOfferLog({
        product_sku: selectedProduct.sku,
        product_name: selectedProduct.name,
        product_price: selectedProduct.price,
        product_max_discount_percentage: selectedProduct.maxDiscountPercentage,
        offered_amount: offerPrice,
        offer_status: isAccepted ? 'accepted' : 'rejected',
        attempts_remaining: newAttempts
      });

      if (isAccepted) {
        // Convert offer log to coupon format and add to local state
        const newCoupon = {
          ...transformOfferLogToCoupon(offerLog),
          productImage: selectedProduct.image,
          productSku: selectedProduct.sku
        };
        saveCoupons([...coupons, newCoupon]);
        setLastOfferResult('accepted');
        setCurrentScreen('result');
      } else {
        setAttemptsRemaining(newAttempts);
        setLastOfferResult('rejected');
        setCurrentScreen('result');
      }
    } catch (error) {
      console.error('Error saving offer:', error);
      // Fall back to old behavior if database fails
      if (isAccepted) {
        const newCoupon: Coupon = {
          id: Date.now().toString(),
          productName: selectedProduct.name,
          offeredPrice: offerPrice,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          type: 'accepted',
          code: generateCode(),
          productImage: selectedProduct.image,
          productSku: selectedProduct.sku
        };
        saveCoupons([...coupons, newCoupon]);
        setLastOfferResult('accepted');
        setCurrentScreen('result');
      } else {
        setAttemptsRemaining(newAttempts);
        setLastOfferResult('rejected');
        setCurrentScreen('result');
      }
    }
  };

  const handleAcceptSpecialDiscount = () => {
    const specialDiscountCoupon: Coupon = {
      id: Date.now().toString(),
      productName: 'Camisa Blanca',
      offeredPrice: 0, // Not applicable for percentage discount
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      type: 'special-discount',
      code: generateCode(),
      discountPercentage: 15
    };
    saveCoupons([...coupons, specialDiscountCoupon]);
    
    // Reset the offer flow state
    setSelectedProduct(null);
    setOfferPrice(75000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    
    // Navigate to coupons screen
    setCurrentScreen('coupons');
  };

  const resetFlow = () => {
    setOfferPrice(75000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    setCurrentScreen('onboarding');
  };

  const goToHomeProducts = () => {
    // Reset all state to ensure clean navigation to products list
    setSelectedProduct(null);
    setCurrentScreen('products');
    setProductError(null);
    setOfferPrice(75000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    
    // Navigate to root route
    navigate('/');
  };

  const handleExit = () => {
    setShowExitDialog(false);
    // If we don't have a specific product (we're on home route), go to products screen
    if (!sku) {
      setCurrentScreen('products');
    }
    navigate('/');
  };

  // QR Scanner functions
  const startQRScanner = async () => {
    try {
      setIsScanning(true);
      setScanError(null);
      
      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      // Set back camera preference directly without device enumeration
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
        } catch (cameraError) {
          console.error('Error accessing camera:', cameraError);
          throw new Error('No se pudo acceder a la cámara. Verifica los permisos.');
        }
      }

      await codeReaderRef.current.decodeFromVideoDevice(
        undefined, // Let it use the stream we already set
        videoRef.current!,
        (result, error) => {
          if (result) {
            // QR code successfully scanned
            const scannedText = result.getText();
            console.log('QR Code scanned:', scannedText);
            
            // Stop scanning
            stopQRScanner();
            
            // Try to extract SKU from the scanned QR code
            handleQRResult(scannedText);
          }
          
          if (error && error.name !== 'NotFoundException') {
            console.error('QR Scanner error:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error starting QR scanner:', error);
      setScanError(error instanceof Error ? error.message : 'Error al iniciar la cámara');
      setIsScanning(false);
    }
  };

  const stopQRScanner = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    
    // Stop camera stream to free up camera
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const handleQRResult = (scannedText: string) => {
    // Try to extract SKU from the scanned QR code
    // Assuming QR codes contain either just the SKU or a URL with the SKU
    let extractedSku = scannedText;
    
    // If it's a URL, try to extract SKU from it
    if (scannedText.includes('/products/')) {
      const match = scannedText.match(/\/products\/([^/?]+)/);
      if (match) {
        extractedSku = match[1];
      }
    }
    
    // Navigate to the product page
    navigate(`/products/${extractedSku}?qr=true`);
  };

  // Cleanup QR scanner when component unmounts or screen changes
  useEffect(() => {
    return () => {
      stopQRScanner();
    };
  }, []);

  // Start QR scanner when camera screen is shown
  useEffect(() => {
    if (currentScreen === 'camera') {
      startQRScanner();
    } else {
      stopQRScanner();
    }
  }, [currentScreen]);

  const TimeDisplay = ({
    expiresAt
  }: {
    expiresAt: Date;
  }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const expiry = expiresAt.getTime();
        const difference = expiry - now;

        if (difference > 0) {
          const hours = Math.floor(difference % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
          const minutes = Math.floor(difference % (1000 * 60 * 60) / (1000 * 60));
          const seconds = Math.floor(difference % (1000 * 60) / 1000);
          setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
        } else {
          setTimeLeft('Expirado');
        }
      }, 1000);

      return () => clearInterval(timer);
    }, [expiresAt]);

    return (
      <div className="flex items-center gap-2 text-sm">
        <Clock size={16} />
        <span className={timeLeft === 'Expirado' ? 'text-red-500' : 'text-green-600'}>
          {timeLeft}
        </span>
      </div>
    );
  };

  const HamburgerMenu = () => (
    <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="p-2">
          <Menu size={24} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80">
        <div className="flex flex-col gap-4 mt-8">
          <Button
            onClick={() => {
              goToHomeProducts();
              setIsMenuOpen(false);
            }}
            variant="ghost"
            className="flex items-center gap-3 justify-start p-4 h-auto"
          >
            <ShoppingBag size={20} />
            <span className="text-lg">Home</span>
          </Button>
          <Button
            onClick={() => {
              setCurrentScreen('productsList');
              setIsMenuOpen(false);
            }}
            variant="ghost"
            className="flex items-center gap-3 justify-start p-4 h-auto"
          >
            <ShoppingBag size={20} />
            <span className="text-lg">Ver productos disponibles</span>
          </Button>
          <Button
            onClick={() => {
              setCurrentScreen('camera');
              setIsMenuOpen(false);
            }}
            className="flex items-center gap-3 justify-start p-4 h-auto text-white"
            style={{
              backgroundColor: '#B5FFA3',
              color: '#000'
            }}
          >
            <Camera size={20} />
            <span className="text-lg">Escanear nuevo producto</span>
          </Button>
          <Button
            onClick={() => {
              setCurrentScreen('coupons');
              setIsMenuOpen(false);
            }}
            variant="ghost"
            className="flex items-center gap-3 justify-start p-4 h-auto"
          >
            <Receipt size={20} />
            <span className="text-lg">Mis ofertas</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

  // Loading Screen
  if (isLoadingProduct) {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend flex flex-col justify-center items-center">
        <div className="text-center w-full max-w-md mx-auto">
          <h1 className="text-5xl font-bold mb-6">ShuQ</h1>
          <p className="text-xl text-gray-600">
            {sku ? 'Cargando producto...' : 'Cargando productos...'}
          </p>
        </div>
      </div>
    );
  }

  // Error Screen
  if (productError) {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend flex flex-col justify-center items-center">
        <div className="text-center w-full max-w-md mx-auto">
          <h1 className="text-5xl font-bold mb-6">ShuQ</h1>
          <p className="text-xl text-red-600 mb-4">{productError}</p>
          <Button 
            onClick={() => navigate('/')}
            className="bg-purple-600 text-white rounded-2xl px-6 py-3"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  // Check if we need a specific product but don't have it
  if (sku && !selectedProduct) {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend flex flex-col justify-center items-center">
        <div className="text-center w-full max-w-md mx-auto">
          <h1 className="text-5xl font-bold mb-6">ShuQ</h1>
          <p className="text-xl text-red-600 mb-4">Producto no encontrado</p>
          <Button 
            onClick={() => navigate('/')}
            className="bg-purple-600 text-white rounded-2xl px-6 py-3"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  // Loader Screen
  if (currentScreen === 'loader') {
    // Check if this is the first time user (for splash screen)
    const isFirstTime = sku && selectedProduct && !hasSeenOnboarding();
    
    if (isFirstTime) {
      // Show full splash screen for first-time users
      return (
        <div className="min-h-screen font-lexend flex flex-col justify-center items-center relative overflow-hidden"
             style={{
               background: 'linear-gradient(180deg, #8B5FBF 0%, #6B46C1 50%, #7C3AED 100%)'
             }}>
          <div className="text-center w-full max-w-md mx-auto px-8">
            {/* ShuQ Logo with Corner Brackets */}
            <div className="relative mb-16">
              {/* Corner Brackets - Viewfinder Style */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-48 h-32">
                  {/* Top-left corner */}
                  <div className="absolute -top-4 -left-4 w-8 h-8">
                    <div className="w-6 h-1 bg-green-400 rounded-full"></div>
                    <div className="w-1 h-6 bg-green-400 rounded-full"></div>
                  </div>
                  {/* Top-right corner */}
                  <div className="absolute -top-4 -right-4 w-8 h-8">
                    <div className="w-6 h-1 bg-green-400 rounded-full ml-2"></div>
                    <div className="w-1 h-6 bg-green-400 rounded-full ml-7"></div>
                  </div>
                  {/* Bottom-left corner */}
                  <div className="absolute -bottom-4 -left-4 w-8 h-8">
                    <div className="w-1 h-6 bg-green-400 rounded-full"></div>
                    <div className="w-6 h-1 bg-green-400 rounded-full mt-1"></div>
                  </div>
                  {/* Bottom-right corner */}
                  <div className="absolute -bottom-4 -right-4 w-8 h-8">
                    <div className="w-1 h-6 bg-green-400 rounded-full ml-7"></div>
                    <div className="w-6 h-1 bg-green-400 rounded-full ml-2 mt-1"></div>
                  </div>
                </div>
              </div>
              
              {/* ShuQ Text */}
              <h1 className="text-7xl font-bold text-white relative z-10 tracking-wide">
                ShuQ
              </h1>
            </div>
            
            {/* Tagline */}
            <div className="space-y-2">
              <p className="text-3xl font-medium text-white opacity-90">
                Elegí la prenda...
              </p>
              <p className="text-3xl font-bold text-black bg-white bg-opacity-90 px-4 py-2 rounded-2xl inline-block">
                ¡Y el precio!
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      // Show simple QR icon loader for returning users
      return (
        <div className="min-h-screen bg-white font-lexend flex flex-col justify-center items-center">
          <div className="text-center">
            {/* QR Code Icon */}
            <div className="mb-4">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="mx-auto text-gray-600">
                <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none"/>
                <rect x="13" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none"/>
                <rect x="3" y="13" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="2" fill="none"/>
                <rect x="5" y="5" width="4" height="4" fill="currentColor"/>
                <rect x="15" y="5" width="4" height="4" fill="currentColor"/>
                <rect x="5" y="15" width="4" height="4" fill="currentColor"/>
                <rect x="13" y="13" width="2" height="2" fill="currentColor"/>
                <rect x="17" y="13" width="2" height="2" fill="currentColor"/>
                <rect x="19" y="15" width="2" height="2" fill="currentColor"/>
                <rect x="15" y="17" width="2" height="2" fill="currentColor"/>
                <rect x="13" y="19" width="2" height="2" fill="currentColor"/>
                <rect x="17" y="19" width="2" height="2" fill="currentColor"/>
                <rect x="19" y="17" width="2" height="2" fill="currentColor"/>
              </svg>
            </div>
            
            {/* Loading text */}
            <p className="text-gray-600 text-sm">Cargando...</p>
          </div>
        </div>
      );
    }
  }

  // Onboarding Screen
  if (currentScreen === 'onboarding') {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto">
          {/* Header with Menu and Title */}
          <div className="flex justify-between items-center mb-8">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          {/* Main Content */}
          <div className="flex flex-col px-4 mt-8">
            <h2 className="text-3xl font-bold mb-8 text-left">¿Cómo funciona?</h2>
            
            <div className="space-y-4 mb-8">
              {/* Card 1 - Purple */}
              <div className="flex items-center gap-4 p-6 rounded-3xl" style={{ backgroundColor: '#C4A5F5' }}>
                {/* Dice/Cube Icon */}
                <div className="flex-shrink-0">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-gray-800">
                    <path d="M8 12L16 8L24 12L16 16L8 12Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.3"/>
                    <path d="M8 12V20L16 24V16L8 12Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.2"/>
                    <path d="M16 16V24L24 20V12L16 16Z" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg mb-1">Tenés 3 oportunidades</p>
                  <p className="font-medium text-gray-700">para hacer tu mejor oferta.</p>
                </div>
              </div>

              {/* Card 2 - Light Blue */}
              <div className="flex items-center gap-4 p-6 rounded-3xl" style={{ backgroundColor: '#B3E5F7' }}>
                {/* Slider Icon */}
                <div className="flex-shrink-0">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-gray-800">
                    <rect x="4" y="14" width="24" height="4" rx="2" fill="currentColor" fillOpacity="0.3"/>
                    <circle cx="12" cy="16" r="4" fill="currentColor"/>
                    <rect x="2" y="12" width="4" height="8" rx="2" fill="currentColor" fillOpacity="0.6"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg mb-1">Para ofertar</p>
                  <p className="font-medium text-gray-700">usá el slider o ingresá el valor manualmente.</p>
                </div>
              </div>

              {/* Card 3 - Yellow */}
              <div className="flex items-center gap-4 p-6 rounded-3xl" style={{ backgroundColor: '#F7E89B' }}>
                {/* Sparkle/Star Icon */}
                <div className="flex-shrink-0">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-gray-800">
                    <path d="M16 4L18.5 11.5L26 14L18.5 16.5L16 24L13.5 16.5L6 14L13.5 11.5L16 4Z" fill="currentColor"/>
                    <path d="M24 8L25 10L27 11L25 12L24 14L23 12L21 11L23 10L24 8Z" fill="currentColor" fillOpacity="0.7"/>
                    <path d="M8 6L8.5 7.5L10 8L8.5 8.5L8 10L7.5 8.5L6 8L7.5 7.5L8 6Z" fill="currentColor" fillOpacity="0.5"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-lg mb-1">El sistema aprueba</p>
                  <p className="font-medium text-gray-700">las mejores ofertas ¡al instante!</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                markOnboardingSeen();
                setCurrentScreen('offer');
              }}
              className="w-full px-8 py-4 text-lg font-bold rounded-2xl"
              style={{
                backgroundColor: '#2D3748',
                color: '#fff'
              }}
            >
              Comenzar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Home Screen - Clean & Minimalistic Design
  if (currentScreen === 'products') {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto h-full flex flex-col">
          {/* Header with Menu */}
          <div className="flex justify-between items-center mb-8">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          {/* Main Content - Perfectly Centered */}
          <div className="flex-1 flex flex-col justify-center items-center px-4">
            {/* Main Tagline - Clean & Centered */}
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                Elegí la prenda
              </h2>
              <p className="text-4xl font-bold text-gray-900 relative">
                y proponé{" "}
                <span className="relative inline-block">
                  tu precio.
                  {/* Crayon-style underline */}
                  <svg 
                    className="absolute -bottom-2 left-0 w-full h-3" 
                    viewBox="0 0 200 12" 
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path 
                      d="M2 8C20 4 40 10 60 6C80 2 100 8 120 5C140 2 160 7 180 4C185 3 190 4 198 5" 
                      stroke="#8069FF" 
                      strokeWidth="4" 
                      strokeLinecap="round"
                      style={{
                        filter: 'url(#crayon-texture)'
                      }}
                    />
                    <defs>
                      <filter id="crayon-texture">
                        <feTurbulence 
                          baseFrequency="0.9 0.1" 
                          numOctaves="2" 
                          result="noise"
                        />
                        <feDisplacementMap 
                          in="SourceGraphic" 
                          in2="noise" 
                          scale="1"
                        />
                      </filter>
                    </defs>
                  </svg>
                </span>
              </p>
            </div>

            {/* Primary CTA Button */}
            <Button
              onClick={() => setCurrentScreen('camera')}
              className="w-full max-w-sm px-8 py-6 text-xl font-bold rounded-3xl shadow-lg transform transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              Escanear código QR
            </Button>

            {/* Subtle secondary action */}
            <button
              onClick={() => setCurrentScreen('productsList')}
              className="mt-6 text-gray-500 text-lg font-medium underline decoration-dotted hover:text-gray-700 transition-colors"
            >
              Ver productos disponibles
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Products List Screen (Moved from Home)
  if (currentScreen === 'productsList') {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto">
          {/* Header with Back Button */}
          <div className="flex justify-between items-center mb-8">
            <Button 
              onClick={() => setCurrentScreen('products')} 
              variant="ghost" 
              className="p-2"
            >
              <X size={24} />
            </Button>
            <h1 className="text-lg font-semibold">Productos Disponibles</h1>
            <div className="w-10"></div> {/* Spacer */}
          </div>

          {/* Products List */}
          <div className="px-4">
            <div className="space-y-3">
              {allProducts.map((product) => (
                <div 
                  key={product.id} 
                  className="p-4 border border-gray-200 rounded-2xl cursor-pointer hover:border-purple-300 hover:bg-gray-50 transition-all"
                  onClick={() => navigate(`/products/${product.sku}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <ProductImage
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover object-center"
                        sku={product.sku}
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">{product.name}</h3>
                      <p className="text-gray-600 text-sm">${product.price.toLocaleString()}</p>
                    </div>
                    <div className="text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera Screen
  if (currentScreen === 'camera') {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto h-full">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 relative z-10">
            <Button 
              onClick={() => setCurrentScreen('products')} 
              variant="ghost" 
              className="p-2"
            >
              <X size={24} />
            </Button>
            <h1 className="text-lg font-semibold">Escanear QR</h1>
            <div className="w-10"></div> {/* Spacer */}
          </div>

          {/* Camera Container */}
          <div className="relative h-full flex flex-col">
            {/* Video Element */}
            <div className="flex-1 relative rounded-3xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              
              {/* Minimalist Scanning Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Corner brackets only */}
                <div className="relative w-56 h-56">
                  {/* Top-left corner */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white rounded-tl-sm"></div>
                  {/* Top-right corner */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white rounded-tr-sm"></div>
                  {/* Bottom-left corner */}
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white rounded-bl-sm"></div>
                  {/* Bottom-right corner */}
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white rounded-br-sm"></div>
                  
                  {/* Center hint text */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white text-sm font-medium bg-black bg-opacity-50 px-3 py-1 rounded-full">
                      Apuntá al código QR
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Messages */}
              {scanError && (
                <div className="absolute top-6 left-6 right-6 bg-red-500 text-white p-4 rounded-2xl text-center font-medium">
                  {scanError}
                </div>
              )}
              
              {isScanning && (
                <div className="absolute bottom-6 left-6 right-6 bg-white bg-opacity-90 text-gray-800 p-3 rounded-2xl text-center font-medium">
                  Buscando código QR...
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="mt-4 space-y-3">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">Escaneá el código QR</h2>
                <p className="text-gray-600 text-sm">Apuntá la cámara al código QR de la prenda</p>
              </div>
              
              {/* Test Buttons for Development */}
              <div className="space-y-2">
                <Button
                  onClick={() => handleQRResult('5245NE')}
                  className="w-full px-4 py-3 text-sm rounded-xl"
                  style={{
                    backgroundColor: '#B5FFA3',
                    color: '#000'
                  }}
                >
                  🧪 Simular: SWEATER MOKA NEGRO
                </Button>
                
                <Button
                  onClick={() => handleQRResult('6604VIYMLNE')}
                  className="w-full px-4 py-3 text-sm rounded-xl"
                  style={{
                    backgroundColor: '#E5E7EB',
                    color: '#000'
                  }}
                >
                  🧪 Simular: BUZO ESPRESSO NEGRO
                </Button>
              </div>
              
              <Button 
                onClick={() => setCurrentScreen('products')} 
                variant="outline" 
                className="w-full rounded-xl py-3 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
              >
                Volver
              </Button>
            </div>
          </div>
        </div>

        <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
      </div>
    );
  }

  // Offer Screen
  if (currentScreen === 'offer') {
    // Initialize offer price to product price if not set
    if (offerPrice === 75000 || offerPrice < selectedProduct.price * 0.1) {
      setOfferPrice(selectedProduct.price);
    }
    
    const discountPercentage = Math.round((selectedProduct.price - offerPrice) / selectedProduct.price * 100);

    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto">
          {/* Header with Menu and Title */}
          <div className="flex justify-between items-center mb-8">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          {/* Product Card */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                <ProductImage
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover object-center"
                  sku={selectedProduct.sku}
                />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900 mb-1">{selectedProduct.name}</h2>
                <p className="text-gray-600 text-sm">Precio oficial: ${selectedProduct.price.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Question */}
          <h3 className="text-xl font-bold text-gray-900 mb-6">¿Cuánto querés pagar?</h3>

          {/* Slider Section */}
          <div className="mb-6">
            <div className="relative mb-3">
              <input
                type="range"
                min={0}
                max={selectedProduct.price}
                step={1000}
                value={offerPrice}
                onChange={e => setOfferPrice(Number(e.target.value))}
                className="w-full thin-purple-slider"
                style={{
                  background: `linear-gradient(to right, #8069FF 0%, #8069FF ${offerPrice / selectedProduct.price * 100}%, #e5e7eb ${offerPrice / selectedProduct.price * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>$0</span>
              <span>${selectedProduct.price.toLocaleString()}</span>
            </div>
          </div>

          {/* Manual Input Section */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">Ingresá el monto manualmente</p>
            <input
              type="number"
              value={offerPrice}
              onChange={e => setOfferPrice(Number(e.target.value))}
              className="w-full p-4 border border-gray-200 rounded-2xl text-center text-lg bg-white"
              placeholder="Ingresá tu oferta"
            />
          </div>

          {/* Attempts Section */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="text-center">
              <div className="flex justify-center gap-2 mb-2">
                {attemptsRemaining === 3 && (
                  <>
                    <span className="text-2xl">🙊</span>
                    <span className="text-2xl">🙉</span>
                    <span className="text-2xl">🙈</span>
                  </>
                )}
                {attemptsRemaining === 2 && (
                  <>
                    <span className="text-2xl opacity-30">⚪</span>
                    <span className="text-2xl">🙉</span>
                    <span className="text-2xl">🙈</span>
                  </>
                )}
                {attemptsRemaining === 1 && (
                  <>
                    <span className="text-2xl opacity-30">⚪</span>
                    <span className="text-2xl opacity-30">⚪</span>
                    <span className="text-2xl">🙈</span>
                  </>
                )}
              </div>
              <span className="text-gray-700 font-medium">
                {attemptsRemaining === 1 ? 'Tenés un intento' : `Tenés ${attemptsRemaining} intentos`}
              </span>
            </div>
          </div>

          {/* Price Display */}
          <div className="text-center mb-8">
            <p className="text-5xl font-bold text-gray-900 mb-2">${offerPrice.toLocaleString()}</p>
            <p className="text-gray-600">
              {discountPercentage}% OFF del precio original
            </p>
          </div>

          {/* Offer Button */}
          <Button
            onClick={handleSendOffer}
            className="w-full rounded-2xl py-4 text-lg font-bold"
            style={{
              backgroundColor: '#B5FFA3',
              color: '#000'
            }}
          >
            Ofertar
          </Button>
        </div>

        <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
      </div>
    );
  }

  // Result screens
  if (currentScreen === 'result') {
    if (lastOfferResult === 'accepted') {
      const acceptedCoupon = coupons[coupons.length - 1]; // Get the most recent coupon
      
      // Calculate discount percentage
      const discountPercentage = selectedProduct ? Math.round((selectedProduct.price - offerPrice) / selectedProduct.price * 100) : 0;

      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-lexend">
          <div className="max-w-md mx-auto w-full">
            {/* Header with Menu */}
            <div className="flex justify-between items-center mb-8">
              <HamburgerMenu />
              <h1 className="text-lg font-semibold text-gray-700">ShuQ</h1>
              <div className="w-6"></div> {/* Spacer for center alignment */}
            </div>

            <div className="flex-1 flex flex-col justify-center px-4">
              
              {/* Enhanced Green success card with discount */}
              <div className="bg-gradient-to-r from-green-300 to-green-400 rounded-2xl p-6 mb-8 relative overflow-hidden shadow-lg" 
                   style={{
                     boxShadow: '0 10px 25px rgba(34, 197, 94, 0.3), 0 4px 10px rgba(34, 197, 94, 0.2)'
                   }}>
                <div className="flex items-center gap-4">
                  {/* Happy face without background */}
                  <div className="flex-shrink-0">
                    <img 
                      src="/lovable-uploads/happy-face-accepted.png" 
                      alt="Happy face" 
                      className="w-16 h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="text-4xl">😄</div>';
                      }}
                    />
                  </div>
                  {/* Success text with discount */}
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">¡Tu oferta fue aceptada!</h2>
                    <p className="text-lg font-medium text-gray-800">Obtuviste {discountPercentage}% OFF</p>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-center mb-8">
                <p className="text-gray-600 text-base font-medium">
                  Mostrá este cupón en caja
                </p>
                <p className="text-gray-600 text-base font-medium">
                  y pagá lo que ofertaste
                </p>
              </div>
              
              {/* Coupon code in light grey rectangle */}
              <div className="bg-gray-100 rounded-2xl p-8 mb-6 border-2 border-gray-200 shadow-md">
                <div className="text-center">
                  <p className="text-5xl font-bold text-gray-900 mb-3 tracking-wider font-mono">
                    {acceptedCoupon?.code || 'NOCB1FFP'}
                  </p>
                  <p className="text-gray-700 text-base font-medium">
                    {selectedProduct?.name?.toUpperCase()} por ${offerPrice.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-4 w-full mt-12">
                <Button 
                  onClick={() => setCurrentScreen('productsList')} 
                  className="w-full text-white rounded-2xl py-4 text-base font-medium bg-black hover:bg-gray-800"
                >
                  Ver más productos
                </Button>
                <Button 
                  onClick={() => setCurrentScreen('coupons')} 
                  variant="outline" 
                  className="w-full rounded-2xl py-4 text-base font-medium border-black text-black hover:bg-gray-50"
                >
                  Ver mis cupones
                </Button>
              </div>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // Rejected - check if no attempts remaining (Final rejection screen) - Blue theme
    if (attemptsRemaining === 0) {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-lexend">
          <div className="max-w-md mx-auto w-full">
            {/* Header with Menu */}
            <div className="flex justify-between items-center mb-8">
              <HamburgerMenu />
              <h1 className="text-lg font-semibold">ShuQ</h1>
              <div className="w-6"></div>
            </div>

            <div className="flex-1 flex flex-col justify-center px-4">
              {/* Blue colored card with rejected face */}
              <div className="bg-gradient-to-r from-blue-200 to-blue-300 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src="/lovable-uploads/rejected-face.png" 
                      alt="Rejected face" 
                      className="w-16 h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="text-4xl">😔</div>';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">No se dio esta vez</h2>
                    <p className="text-base font-medium text-gray-800">¡Pero no te vas con las manos vacías!</p>
                  </div>
                </div>
              </div>

              {/* Description text */}
              <div className="text-center mb-6">
                <p className="text-gray-700 text-base font-medium">
                  Desbloqueaste un descuento exclusivo para llevarte esta prenda igual.
                </p>
              </div>

              {/* Special Discount Section - More Bouncy */}
              <div className="text-center mb-8">
                {/* Prominent OFERTA ESPECIAL header */}
                <div className="mb-6">
                  <h3 className="text-4xl font-extrabold tracking-wide" style={{ color: '#87CEEB' }}>
                    OFERTA ESPECIAL
                  </h3>
                </div>
                
                {/* Enhanced Bouncy Coupon Card */}
                <div className="relative">
                  {/* Main coupon card with enhanced styling */}
                  <div className="bg-white p-8 rounded-3xl transform transition-all duration-300 hover:scale-105"
                       style={{
                         boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 8px 16px rgba(0, 0, 0, 0.08)',
                         border: '2px solid #f0f0f0'
                       }}>
                    <div className="text-center">
                      <p className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
                        15% OFF en Camisa Blanca
                      </p>
                      <p className="text-base text-gray-600 font-medium">
                        Cupón válido por 30 minutos
                      </p>
                    </div>
                  </div>
                  
                  {/* Subtle background decoration */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-100 to-blue-200 rounded-3xl -z-10 opacity-30"></div>
                </div>
              </div>

              {/* CTA Button */}
              <Button 
                onClick={handleAcceptSpecialDiscount} 
                className="w-full bg-black text-white rounded-2xl py-4 text-base font-medium hover:bg-gray-800"
              >
                Aceptar el descuento
              </Button>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // Rejected - with attempts remaining
    // Determine which attempt this is (3 - attemptsRemaining gives us the attempt number)
    const currentAttempt = 3 - attemptsRemaining + 1;
    
    // First attempt (2 attempts remaining) - Peach/Orange theme
    if (attemptsRemaining === 2) {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-lexend">
          <div className="max-w-md mx-auto w-full">
            {/* Header with Menu and Exit */}
            <div className="flex justify-between items-center mb-8">
              <HamburgerMenu />
              <h1 className="text-lg font-semibold">ShuQ</h1>
              <div className="w-6"></div>
            </div>

            <div className="flex-1 flex flex-col justify-center px-4">
              {/* Peach colored card */}
              <div className="bg-gradient-to-r from-orange-200 to-orange-300 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src="/lovable-uploads/intent-1-face.png" 
                      alt="Close face" 
                      className="w-16 h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="text-4xl">😌</div>';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">¡Estuviste cerca!</h2>
                    <p className="text-base font-medium text-gray-800">Probá ofertar de nuevo.</p>
                  </div>
                </div>
              </div>

              {/* Tip section */}
              <div className="text-center mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-2">¿Sabías que?</p>
                <p className="text-gray-600 text-sm">
                  A veces un pequeño ajuste hace toda la diferencia
                </p>
              </div>

              {/* Attempts remaining */}
              <div className="flex justify-center items-center gap-2 mb-8">
                <div className="flex gap-2">
                  <span className="text-2xl opacity-30">⚪</span>
                  <span className="text-2xl">🙉</span>
                  <span className="text-2xl">🙈</span>
                </div>
                <span className="text-gray-700 font-medium ml-2">Te quedan dos intentos</span>
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => setCurrentScreen('offer')}
                className="w-full bg-black text-white rounded-2xl py-4 text-base font-medium hover:bg-gray-800"
              >
                Hacer nueva oferta
              </Button>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // Second attempt (1 attempt remaining) - Purple theme
    if (attemptsRemaining === 1) {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-lexend">
          <div className="max-w-md mx-auto w-full">
            {/* Header with Menu and Exit */}
            <div className="flex justify-between items-center mb-8">
              <HamburgerMenu />
              <h1 className="text-lg font-semibold">ShuQ</h1>
              <div className="w-6"></div>
            </div>

            <div className="flex-1 flex flex-col justify-center px-4">
              {/* Purple colored card */}
              <div className="bg-gradient-to-r from-purple-200 to-purple-300 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <img 
                      src="/lovable-uploads/intent-2-face.png" 
                      alt="Heart eyes face" 
                      className="w-16 h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="text-4xl">😍</div>';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">¡A un paso de lograrlo!</h2>
                    <p className="text-base font-medium text-gray-800">Ofertá una vez más</p>
                  </div>
                </div>
              </div>

              {/* Tip section */}
              <div className="text-center mb-6">
                <p className="text-sm font-semibold text-gray-900 mb-2">¿Sabías que?</p>
                <p className="text-gray-600 text-sm">
                  Esta es la jugada clave, ¡que sea la más precisa!
                </p>
              </div>

              {/* Attempts remaining */}
              <div className="flex justify-center items-center gap-2 mb-8">
                <div className="flex gap-2">
                  <span className="text-2xl opacity-30">⚪</span>
                  <span className="text-2xl opacity-30">⚪</span>
                  <span className="text-2xl">🙈</span>
                </div>
                <span className="text-gray-700 font-medium ml-2">Te queda un intento</span>
              </div>

              {/* CTA Button */}
              <Button
                onClick={() => setCurrentScreen('offer')}
                className="w-full bg-black text-white rounded-2xl py-4 text-base font-medium hover:bg-gray-800"
              >
                Hacer nueva oferta
              </Button>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // This shouldn't happen since we handle attemptsRemaining === 0 above, but just in case
    return null;
  }

  // Coupons Screen
  if (currentScreen === 'coupons') {
    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto">
          {/* Header with Menu and Exit */}
          <div className="flex justify-between items-center mb-4">
            <HamburgerMenu />
            <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
              <X size={24} />
            </Button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Mis ofertas aprobadas</h1>
            <p className="text-gray-600 text-sm">Mostrá el código en caja para pagar el precio acordado.</p>
          </div>

          {activeCoupons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No tenés ofertas aprobadas</p>
              <Button onClick={goToHomeProducts} className="bg-purple-600 text-white rounded-2xl px-6 py-3">
                Ver otros productos
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {activeCoupons.map(coupon => {
                // Special discount coupon styling - more subtle
                if (coupon.type === 'special-discount') {
                  return (
                    <Card key={coupon.id} className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-4">
                        {/* Discount icon - more subtle */}
                        <div className="w-16 h-16 bg-gray-200 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Percent size={24} className="text-gray-600" />
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{coupon.productName}</h3>
                          <p className="text-lg font-bold text-gray-700">
                            {coupon.discountPercentage}% OFF
                          </p>
                          <div className="mt-1">
                            <TimeDisplay expiresAt={coupon.expiresAt} />
                          </div>
                        </div>
                        
                        {/* Code Section */}
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">Código</p>
                          <p className="font-mono font-bold text-lg">{coupon.code}</p>
                        </div>
                      </div>
                    </Card>
                  );
                }
                
                // Regular accepted offer coupon
                return (
                  <Card key={coupon.id} className="p-4 rounded-2xl">
                    <div className="flex items-center gap-4">
                      {/* Product Image */}
                      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {(() => {
                          // Get image URL from coupon or fallback to known product images
                          let imageUrl = coupon.productImage;
                          
                          if (!imageUrl) {
                            // Fallback to known product images based on product name
                            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                            if (coupon.productName.includes('SWEATER GAEL GRIS TOPO')) {
                              imageUrl = `${supabaseUrl}/storage/v1/object/public/products/5208GT.jpg`;
                            } else if (coupon.productName.includes('SWEATER GAEL NEGRO')) {
                              imageUrl = `${supabaseUrl}/storage/v1/object/public/products/5207NE.jpg`;
                            }
                          }
                          
                          return imageUrl ? (
                            <ProductImage
                              src={imageUrl}
                              alt={coupon.productName}
                              className="w-full h-full object-cover object-center"
                              sku={coupon.productSku}
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <ShoppingBag className="w-6 h-6 text-gray-500" />
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{coupon.productName}</h3>
                        <p className="text-lg font-bold text-green-600">
                          ${coupon.offeredPrice.toLocaleString()}
                        </p>
                        <div className="mt-1">
                          <TimeDisplay expiresAt={coupon.expiresAt} />
                        </div>
                      </div>
                      
                      {/* Code Section */}
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-1">Código</p>
                        <p className="font-mono font-bold text-lg">{coupon.code}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
      </div>
    );
  }

  return null;
};

export default ShuQApp;
