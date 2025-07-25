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
  subscribeToAllOfferLogs,
  unsubscribeFromOfferLogs,
  transformOfferLogToCoupon,
  isOfferExpired,
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
  status: 'pendiente' | 'usado' | 'cancelado'; // New status field
  createdAt: Date; // Track when coupon was created
}



const ShuQApp = () => {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQRSimulation = searchParams.get('qr') === 'true';
  
  const [currentScreen, setCurrentScreen] = useState<'loader' | 'offer' | 'result' | 'coupons' | 'camera' | 'products' | 'productsList'>('loader');
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
  const [hasInteractedWithSlider, setHasInteractedWithSlider] = useState<boolean>(false);
  
  // State for live countdown updates in coupons screen
  const [currentTime, setCurrentTime] = useState(new Date());
  
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
      const isFirstTime = sku && selectedProduct && false; // Removed hasSeenOnboarding()
      const loaderTime = isFirstTime ? 3000 : 1500; // 3s for first-time, 1.5s for returning users
      
      const timer = setTimeout(() => {
        if (sku && selectedProduct) {
          // Product page - check if first-time user
          // Removed hasSeenOnboarding() check
          if (false) { // No onboarding for returning users
            // Returning user - go directly to offer
            setCurrentScreen('offer');
          } else {
            // First-time user - show onboarding
            setCurrentScreen('offer'); // Changed to offer screen
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

    // Subscribe to offer log changes for real-time updates from admin actions
    const subscription = subscribeToAllOfferLogs((payload) => {
      // When an offer is updated (e.g., marked as redeemed by admin), reload coupons
      if (payload.eventType === 'UPDATE') {
        loadAcceptedOffers();
      }
    });

    return () => {
      unsubscribeFromOfferLogs(subscription);
    };
  }, []);

  // Reset slider interaction state when entering offer screen
  useEffect(() => {
    if (currentScreen === 'offer') {
      setHasInteractedWithSlider(false);
    }
  }, [currentScreen]);

  // Update time every second for live countdown (only when on coupons screen)
  useEffect(() => {
    if (currentScreen === 'coupons') {
      const interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentScreen]);

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
          productSku: selectedProduct.sku,
          status: 'pendiente' as const,
          createdAt: new Date()
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
          productSku: selectedProduct.sku,
          status: 'pendiente',
          createdAt: new Date()
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
    if (!selectedProduct) return; // Safety check
    
    // Calculate 15% discount price (85% of original price)
    const discountedPrice = Math.round(selectedProduct.price * 0.85);
    
    // Set the offer price to the discounted amount
    setOfferPrice(discountedPrice);
    
    // Create the special discount coupon using normal coupon format
    const specialDiscountCoupon: Coupon = {
      id: Date.now().toString(),
      productName: selectedProduct.name,
      offeredPrice: discountedPrice,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      type: 'accepted', // Use 'accepted' type to follow normal flow
      code: generateCode(),
      productImage: selectedProduct.image,
      productSku: selectedProduct.sku,
      status: 'pendiente',
      createdAt: new Date()
    };
    saveCoupons([...coupons, specialDiscountCoupon]);
    
    // Follow normal accepted offer flow
    setLastOfferResult('accepted');
    setCurrentScreen('result');
  };

  const resetFlow = () => {
    setOfferPrice(75000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    setCurrentScreen('offer'); // Changed to offer screen
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
            <span className="text-lg">Escanear producto</span>
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
            <span className="text-lg">Mis cupones</span>
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
    const isFirstTime = sku && selectedProduct && false; // Removed hasSeenOnboarding()
    
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
          <div className="text-center max-w-sm mx-auto px-4">
            {/* Animated QR Code Icon */}
            <div className="mb-8">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" className="mx-auto text-gray-600 loading-qr-animation">
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
            
            {/* Loading text with new copy */}
            <p className="text-gray-700 text-lg font-medium leading-relaxed">
              ¿Cuánto pagarías por esta prenda?
            </p>
            
            {/* Loading dots animation */}
            <div className="flex justify-center mt-4">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      );
    }
  }

  // Home Screen - Clean & Minimalistic Design
  if (currentScreen === 'products') {
    return (
      <div className="min-h-screen bg-white p-4 font-lexend">
        <div className="max-w-md mx-auto min-h-screen flex flex-col">
          {/* Header with Menu */}
          <div className="flex justify-between items-center mb-4">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          {/* Main Content - Perfectly Centered */}
          <div className="flex-1 flex flex-col justify-center items-center px-4">
            {/* Main Tagline - Clean & Centered in 2 lines */}
            <div className="text-center mb-8 w-full max-w-sm">
              <h2 className="text-3xl font-bold text-gray-900 leading-tight">
                Elegí la prenda y
              </h2>
              <p className="text-3xl font-bold text-gray-900">
                proponé{" "}
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
              className="w-full max-w-sm px-8 py-6 text-xl font-bold rounded-2xl shadow-lg transform transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              Escanear código QR
            </Button>
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
        <div className="max-w-md mx-auto min-h-screen flex flex-col">
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
          <div className="relative flex-1 flex flex-col -mt-2">
            {/* Video Element */}
            <div className="relative rounded-3xl overflow-hidden bg-black" style={{ height: '60vh' }}>
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
    // Check if user already has an accepted offer for this product
    const existingOffer = coupons.find(coupon => 
      coupon.productSku === selectedProduct.sku && 
      coupon.type === 'accepted' && 
      new Date() < coupon.expiresAt
    );
    
    // Initialize offer price to product price if not set (only on first load)
    if (offerPrice === 75000) {
      setOfferPrice(selectedProduct.price);
    }
    
    const discountPercentage = Math.round((selectedProduct.price - offerPrice) / selectedProduct.price * 100);

    return (
      <div className="min-h-screen bg-white font-lexend flex flex-col">
        <div className="flex-1 p-4 pb-20">
          <div className="max-w-md mx-auto">
            {/* Header with Menu and Title */}
            <div className="flex justify-between items-center mb-6">
              <HamburgerMenu />
              <h1 className="text-lg font-semibold">ShuQ</h1>
              <div className="w-10"></div> {/* Spacer for centering */}
            </div>

          {/* Product Card */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
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

          {/* Existing Offer Alert */}
          {existingOffer && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-800 mb-1">¡Ya tenés una oferta aprobada!</h4>
                  <p className="text-sm text-green-700">
                    ${existingOffer.offeredPrice.toLocaleString()} - Código: {existingOffer.code}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Question */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {existingOffer ? "Tu oferta actual:" : "¿Cuánto querés pagar?"}
          </h3>

          {/* Pill below heading - positioned with 8px spacing */}
          {!existingOffer && !hasInteractedWithSlider && (
            <div className="flex justify-center mb-5">
              <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border">
                Mové el slider para elegir tu precio
              </span>
            </div>
          )}

          {/* Slider Section - Disabled if existing offer */}
          <div className="mb-5">
            <div className="relative mb-3">
              <input
                type="range"
                min={0}
                max={selectedProduct.price}
                step={1000}
                value={existingOffer ? existingOffer.offeredPrice : offerPrice}
                onChange={e => {
                  if (!existingOffer) {
                    setOfferPrice(Number(e.target.value));
                    setHasInteractedWithSlider(true);
                  }
                }}
                disabled={!!existingOffer}
                className={`w-full thin-purple-slider ${existingOffer ? 'opacity-50 cursor-not-allowed' : 'slider-input-animated'}`}
                style={{
                  background: `linear-gradient(to right, #8069FF 0%, #8069FF ${(existingOffer ? existingOffer.offeredPrice : offerPrice) / selectedProduct.price * 100}%, #e5e7eb ${(existingOffer ? existingOffer.offeredPrice : offerPrice) / selectedProduct.price * 100}%, #e5e7eb 100%)`
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>$0</span>
              <span>${selectedProduct.price.toLocaleString()}</span>
            </div>
          </div>

          {/* Attempts Section - Only show if no existing offer */}
          {!existingOffer && (
            <div className="bg-gray-50 rounded-2xl p-4 mb-5">
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
          )}

          {/* Price Display */}
          <div className="text-center mb-6">
            <p className="text-5xl font-bold text-gray-900 mb-2">
              ${(existingOffer ? existingOffer.offeredPrice : offerPrice).toLocaleString()}
            </p>
            <p className="text-gray-600">
              {existingOffer 
                ? `${Math.round((selectedProduct.price - existingOffer.offeredPrice) / selectedProduct.price * 100)}% OFF del precio original`
                : `${discountPercentage}% OFF del precio original`
              }
            </p>
          </div>

          </div>
        </div>
        
        {/* Fixed Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white">
          <div className="max-w-md mx-auto">
            {existingOffer ? (
              <Button
                onClick={() => setCurrentScreen('coupons')}
                className="w-full rounded-2xl bg-green-600 text-white hover:bg-green-700 font-bold"
                style={{ height: '40px' }}
              >
                Ver cupón
              </Button>
            ) : (
              <Button
                onClick={handleSendOffer}
                className="w-full rounded-2xl font-bold"
                style={{
                  backgroundColor: '#B5FFA3',
                  color: '#000',
                  height: '40px'
                }}
              >
                Ofertar
              </Button>
            )}
          </div>
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
        <div className="min-h-screen bg-white font-lexend flex flex-col">
          <div className="flex-1 p-4 pb-24">
            <div className="max-w-md mx-auto">
              {/* Header with Menu */}
              <div className="flex justify-between items-center mb-4">
                <HamburgerMenu />
                <h1 className="text-lg font-semibold">ShuQ</h1>
                <div className="w-10"></div> {/* Spacer for center alignment */}
              </div>
              
              {/* Happy face image - smaller */}
              <div className="text-center mb-4">
                <img 
                  src="/lovable-uploads/happy-face-accepted.png" 
                  alt="Happy face" 
                  className="w-16 h-16 mx-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div class="text-4xl">😄</div>';
                  }}
                />
              </div>
              
              {/* Success message - smaller */}
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">¡Tu oferta fue aceptada!</h2>
              </div>

              {/* Green card with restructured content */}
              <div className="bg-green-200 rounded-2xl p-4 mb-4 text-center">
                {/* Line 1: Discount title */}
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  Obtuviste {discountPercentage}% OFF
                </h3>
                {/* Line 2: Product name */}
                <p className="text-lg font-medium text-gray-800 mb-1">
                  {selectedProduct?.name?.toUpperCase()}
                </p>
                                 {/* Line 3: Price (bold) */}
                 <p className="text-xl font-bold text-gray-900 mb-3">
                   por ${offerPrice.toLocaleString()}
                 </p>
                <div>
                  <p className="text-xs text-gray-700 mb-1">CUPÓN</p>
                  <p className="text-lg font-bold font-mono text-gray-900">
                    {acceptedCoupon?.code || 'NOCB1FFP'}
                  </p>
                </div>
              </div>

              {/* Instructions - compact */}
              <div className="text-center">
                <p className="text-gray-700 text-sm font-medium">
                  Mostrá este pantalla en caja para finalizar tu compra
                </p>
              </div>
            </div>
          </div>
          
          {/* Fixed Bottom CTAs */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
            <div className="max-w-md mx-auto space-y-2">
              <Button 
                onClick={() => setCurrentScreen('camera')} 
                className="w-full text-white rounded-2xl font-medium bg-black hover:bg-gray-800"
                style={{ height: '40px' }}
              >
                Ver más productos
              </Button>
              <Button 
                onClick={() => setCurrentScreen('coupons')} 
                variant="outline" 
                className="w-full rounded-2xl font-medium border-black text-black hover:bg-gray-50"
                style={{ height: '40px' }}
              >
                Ver mis cupones
              </Button>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // Rejected - check if no attempts remaining (Final rejection screen) - Blue theme
    if (attemptsRemaining === 0) {
      return (
        <div className="min-h-screen bg-white font-lexend flex flex-col">
          <div className="flex-1 p-4 pb-20">
            <div className="max-w-md mx-auto">
              {/* Header with Menu */}
              <div className="flex justify-between items-center mb-6">
                <HamburgerMenu />
                <h1 className="text-lg font-semibold">ShuQ</h1>
                <div className="w-6"></div>
              </div>

              {/* Blue colored card with rejected face - Left aligned, 2 lines */}
              <div className="bg-gradient-to-r from-blue-200 to-blue-300 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <img 
                      src="/lovable-uploads/rejected-face.png" 
                      alt="Rejected face" 
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = '<div class="text-3xl">😔</div>';
                      }}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">No se dio esta vez</h2>
                    <p className="text-lg font-bold text-gray-900">¡Pero no te vas con las manos vacías!</p>
                  </div>
                </div>
              </div>

              {/* Description text - More compact */}
              <div className="text-center mb-4">
                <p className="text-gray-700 text-sm font-medium">
                  Desbloqueaste un descuento exclusivo para llevarte esta prenda igual.
                </p>
              </div>

              {/* Special Discount Section - Compact */}
              <div className="text-center">
                {/* Compact OFERTA ESPECIAL header */}
                <div className="mb-4">
                  <h3 className="text-3xl font-extrabold tracking-wide" style={{ color: '#87CEEB' }}>
                    OFERTA ESPECIAL
                  </h3>
                </div>
                
                {/* Compact Coupon Card */}
                <div className="bg-white p-6 rounded-2xl" style={{
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)', 
                  border: '2px solid #f0f0f0'
                }}>
                  <div className="text-center">
                    <p className="text-xl font-black text-gray-900 mb-2 tracking-tight">
                      15% OFF en {selectedProduct.name}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">
                      Cupón válido por 30 minutos
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Fixed Bottom Button */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white">
            <div className="max-w-md mx-auto">
              <Button 
                onClick={handleAcceptSpecialDiscount} 
                className="w-full bg-black text-white rounded-2xl font-medium hover:bg-gray-800"
                style={{ height: '40px' }}
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
                  <div className="flex-1 text-left">
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">¡Estuviste cerca!</h2>
                    <p className="text-2xl font-bold text-gray-900">Probá ofertar de nuevo</p>
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
                  <div className="flex-1 text-left">
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">¡Estuviste cerca!</h2>
                    <p className="text-2xl font-bold text-gray-900">Probá ofertar de nuevo</p>
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

    // Get coupon status based on time and admin actions
    const getCouponStatus = (coupon: Coupon): 'pendiente' | 'usado' | 'cancelado' => {
      const now = currentTime;
      const thirtyMinutesAfterCreation = new Date(coupon.createdAt.getTime() + 30 * 60 * 1000);
      
      // If admin marked as used, return 'usado' (this comes from database via is_redeemed field)
      if (coupon.status === 'usado') return 'usado';
      
      // If 30 minutes have passed and not used, return 'cancelado'
      if (now > thirtyMinutesAfterCreation) return 'cancelado';
      
      // Otherwise it's still pending
      return 'pendiente';
    };

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'pendiente':
          return <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">Pendiente</span>;
        case 'usado':
          return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">Usado</span>;
        case 'cancelado':
          return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded">cancelado</span>;
        default:
          return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded">{status}</span>;
      }
    };

    const getTimeRemaining = (coupon: Coupon) => {
      const now = currentTime;
      const thirtyMinutesAfterCreation = new Date(coupon.createdAt.getTime() + 30 * 60 * 1000);
      const timeRemaining = thirtyMinutesAfterCreation.getTime() - now.getTime();
      
      if (timeRemaining <= 0) return '0:00';
      
      const minutesRemaining = Math.floor(timeRemaining / (1000 * 60));
      const secondsRemaining = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      
      return `${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')}`;
    };

    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-white p-3 sm:p-4 font-lexend">
        <div className="max-w-md mx-auto">
          {/* Header with Menu, Title, and X */}
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
              <X size={20} className="sm:w-6 sm:h-6" />
            </Button>
          </div>

          {/* Title and Subtitle - Responsive */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl font-bold mb-2">Mis cupones</h1>
            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">Presenta en caja el cupón que quieras abonar.</p>
          </div>

          {activeCoupons.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-lg sm:text-xl text-gray-700 font-medium mb-6 sm:mb-8">No tenés ofertas aprobadas todavía</p>
              <div className="space-y-3">
                <Button
                  onClick={() => setCurrentScreen('camera')}
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-bold rounded-2xl"
                  style={{
                    backgroundColor: '#B5FFA3',
                    color: '#000'
                  }}
                >
                  Escanear QR
                </Button>
                <Button onClick={goToHomeProducts} variant="outline" className="w-full rounded-2xl px-4 sm:px-6 py-3 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white text-sm sm:text-base">
                  Ver otros productos
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4 mb-6">
              {activeCoupons.map(coupon => {
                const status = getCouponStatus(coupon);
                const timeRemaining = getTimeRemaining(coupon);
                const discountPercentage = coupon.discountPercentage || 
                  (selectedProduct ? Math.round((selectedProduct.price - coupon.offeredPrice) / selectedProduct.price * 100) : 15);

                return (
                  <Card key={coupon.id} className="p-3 sm:p-4 rounded-2xl border border-gray-200">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                      {/* Product Image - Responsive */}
                      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                            </div>
                          );
                        })()}
                      </div>
                      
                      {/* Product Info - Responsive Layout */}
                      <div className="flex-1 min-w-0">
                        <div className="text-left space-y-1">
                          {/* Product Name and Code - Stacked on small screens */}
                          <div className="space-y-0.5 sm:space-y-0">
                            <h3 className="font-bold text-xs sm:text-sm leading-tight line-clamp-2">{coupon.productName}</h3>
                            <span className="font-mono text-[10px] sm:text-xs text-gray-500 block">{coupon.code}</span>
                          </div>
                          
                          {/* Discount - Responsive sizing */}
                          <p className="text-base sm:text-lg font-bold text-gray-900">
                            {discountPercentage}% OFF
                          </p>
                          
                          {/* Timer - Compact on small screens */}
                          {status === 'pendiente' && (
                            <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={10} className="sm:w-3 sm:h-3" />
                              <span>{timeRemaining}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status and Price Section - Responsive */}
                      <div className="text-right flex-shrink-0">
                        <div className="mb-1 sm:mb-2">
                          {getStatusBadge(status)}
                        </div>
                        <p className="text-base sm:text-lg font-bold text-gray-900">
                          ${coupon.offeredPrice.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Add scan button when there are active coupons - Responsive */}
          {activeCoupons.length > 0 && (
            <div className="mt-4 sm:mt-6">
              <Button
                onClick={() => setCurrentScreen('camera')}
                className="w-full px-4 sm:px-6 py-3 sm:py-4 text-base sm:text-lg font-bold rounded-2xl"
                style={{
                  backgroundColor: '#B5FFA3',
                  color: '#000'
                }}
              >
                Escanear nuevo producto
              </Button>
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
