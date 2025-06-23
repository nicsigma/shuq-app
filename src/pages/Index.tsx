import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ShoppingBag, Clock, CheckCircle, Menu, Camera, Receipt, Percent } from 'lucide-react';
import { ConfirmExitDialog } from '@/components/ConfirmExitDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { getProductBySku, getAllProducts, subscribeToProductChanges, unsubscribeFromProductChanges } from '@/lib/database';
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

// Image component with proper error handling
const ProductImage = ({ src, alt, className }: { src: string; alt: string; className: string }) => {
  const [hasError, setHasError] = useState(false);

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
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
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
}



const ShuQApp = () => {
  const { sku } = useParams<{ sku: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQRSimulation = searchParams.get('qr') === 'true';
  
  const [currentScreen, setCurrentScreen] = useState<'loader' | 'onboarding' | 'offer' | 'result' | 'coupons' | 'camera' | 'products'>('loader');
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
            setOfferPrice(Math.floor(product.price * 0.6)); // Set initial offer to 60% of price
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

  // Auto-advance from onboarding to offer for QR simulations
  useEffect(() => {
    if (currentScreen === 'onboarding' && isQRSimulation && selectedProduct && sku) {
      const timer = setTimeout(() => {
        setCurrentScreen('offer');
      }, 2000); // Show onboarding for 2 seconds, then go to offer
      return () => clearTimeout(timer);
    }
  }, [currentScreen, isQRSimulation, selectedProduct, sku]);

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
      // Load remaining attempts from database
      const loadAttempts = async () => {
        try {
          const remaining = await getRemainingAttempts(selectedProduct.sku);
          setAttemptsRemaining(remaining);
        } catch (error) {
          console.error('Error loading attempts:', error);
        }
      };

      loadAttempts();

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
          productImage: selectedProduct.image
        };
        saveCoupons([...coupons, newCoupon]);
        setLastOfferResult('accepted');
      } else {
        setAttemptsRemaining(newAttempts);
        setLastOfferResult('rejected');
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
          productImage: selectedProduct.image
        };
        saveCoupons([...coupons, newCoupon]);
        setLastOfferResult('accepted');
      } else {
        setAttemptsRemaining(newAttempts);
        setLastOfferResult('rejected');
      }
    }
    
    setCurrentScreen('result');
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
      <div className="min-h-screen bg-white p-4 font-roboto flex flex-col justify-center items-center">
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
      <div className="min-h-screen bg-white p-4 font-roboto flex flex-col justify-center items-center">
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
      <div className="min-h-screen bg-white p-4 font-roboto flex flex-col justify-center items-center">
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
    return (
      <div className="min-h-screen bg-white p-4 font-roboto flex flex-col justify-center items-center">
        <div className="text-center w-full max-w-md mx-auto">
          <h1 className="text-5xl font-bold mb-6">ShuQ</h1>
          <p className="text-xl text-gray-600">Elegí la prenda… y el precio.</p>
        </div>
      </div>
    );
  }

  // Onboarding Screen
  if (currentScreen === 'onboarding') {
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          {/* Header with Menu and Title */}
          <div className="flex justify-between items-center mb-8">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          {/* Main Content */}
          <div className="flex flex-col justify-center text-center px-4 mt-16">
            <h2 className="text-3xl font-bold mb-8">¿Cómo funciona?</h2>
            
            <div className="space-y-6 mb-12 text-left">
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
                <p className="text-gray-700">Tenés 3 oportunidades para hacer tu mejor oferta.</p>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
                <p className="text-gray-700">Para ofertar, usá el slider o ingresá el valor manualmente.</p>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
                <p className="text-gray-700">Cuando tengas tu oferta lista, ¡enviala!</p>
              </div>
            </div>

            <Button
              onClick={() => {
                markOnboardingSeen();
                setCurrentScreen('offer');
              }}
              className="w-full px-8 py-4 text-lg rounded-2xl"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              ¡Empecemos!
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Products List Screen (Home Page)
  if (currentScreen === 'products') {
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          {/* Header with Menu */}
          <div className="flex justify-between items-center mb-8">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <div className="w-10"></div> {/* Spacer for centering */}
          </div>

          {/* Main Content */}
          <div className="px-4">
            {/* QR Scanner Button - Moved to top */}
            <div className="mb-6">
              <Button
                onClick={() => setCurrentScreen('camera')}
                className="w-full rounded-2xl py-4"
                style={{
                  backgroundColor: '#B5FFA3',
                  color: '#000'
                }}
              >
                <Camera size={20} className="mr-2" />
                Escanear código QR
              </Button>
            </div>

            <h2 className="text-2xl font-bold mb-6 text-center">Elegí tu producto</h2>
            
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
      <div className="min-h-screen bg-white p-4 font-roboto">
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
    const discountPercentage = Math.round((selectedProduct.price - offerPrice) / selectedProduct.price * 100);

    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          {/* Header with Menu and Exit */}
          <div className="flex justify-between items-center mb-4">
            <HamburgerMenu />
            <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
              <X size={24} />
            </Button>
          </div>

          {/* Product Details */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
              <ProductImage
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">{selectedProduct.name}</h2>
              <p className="text-gray-600">Precio oficial: ${selectedProduct.price.toLocaleString()}</p>
            </div>
          </div>

          {/* Offer Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold mb-4">¿Cuánto querés pagar?</h3>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={selectedProduct.price}
                  value={offerPrice}
                  onChange={e => setOfferPrice(Number(e.target.value))}
                  className="w-full ultra-thin-slider"
                  style={{
                    background: `linear-gradient(to right, #D5B4F7 0%, #D5B4F7 ${offerPrice / selectedProduct.price * 100}%, #e5e7eb ${offerPrice / selectedProduct.price * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>$0</span>
                <span>${selectedProduct.price.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">Ingresá el monto manualmente</p>
              <input
                type="number"
                value={offerPrice}
                onChange={e => setOfferPrice(Number(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-2xl text-center text-lg max-h-10"
                placeholder="Ingresá tu oferta"
              />
            </div>

            {/* Attempts Indicator - Moved below input */}
            <div className="text-center mb-4">
              <span className={`text-sm font-medium ${getAttemptColor()}`}>{getAttemptText()}</span>
            </div>

            <div className="text-center">
              <p className="text-3xl font-bold">${offerPrice.toLocaleString()}</p>
              <p className="text-sm text-gray-600">
                {discountPercentage}% OFF del precio original
              </p>
            </div>

            <Button
              onClick={handleSendOffer}
              className="w-full rounded-2xl py-6 text-lg"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              Ofertar
            </Button>
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

      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
          <div className="max-w-md mx-auto w-full">
            {/* Header with Menu and Exit */}
            <div className="flex justify-between items-center mb-4">
              <HamburgerMenu />
              <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
                <X size={24} />
              </Button>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center px-4">
              {/* Success emoji */}
              <div className="text-6xl mb-6">☺</div>
            
              <h1 className="text-2xl font-bold mb-6">¡Tu oferta fue aceptada!</h1>
              
              {/* Code Display Section */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Acercate a caja y mostrá este código</h2>
                <div className="bg-gray-100 p-6 rounded-2xl mb-6">
                  <p className="text-4xl font-mono font-bold text-center mb-2">
                    {acceptedCoupon?.code || 'ABC123XY'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {selectedProduct?.name} por ${offerPrice.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Promotional message - smaller and lower */}
              <div className="text-center mb-8 text-sm">
                <p className="font-semibold mb-1 text-gray-600">
              </p>
                <p className="text-gray-500">
              </p>
              </div>

              <div className="space-y-4 w-full">
                <Button onClick={goToHomeProducts} className="w-full bg-purple-600 text-white rounded-2xl py-4">
                  Ver más productos
                </Button>
                <Button onClick={() => setCurrentScreen('coupons')} variant="outline" className="w-full rounded-2xl py-4 border-purple-600 text-purple-600">
                  Ver mis ofertas
                </Button>
              </div>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // Rejected - check if no attempts remaining
    if (attemptsRemaining === 0) {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
          <div className="max-w-md mx-auto w-full">
            {/* Header with Menu and Exit */}
            <div className="flex justify-between items-center mb-4">
              <HamburgerMenu />
              <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
                <X size={24} />
              </Button>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center px-4">
              {/* Sad emoji */}
              <div className="text-6xl mb-6">☹</div>
              
              <h1 className="text-xl font-bold mb-4">Tu oferta no fue aceptada</h1>
              
              <p className="text-gray-600 text-sm mb-6">
                Pero te regalamos un descuento para no irte con las manos vacías.
              </p>

              {/* Special Discount Coupon Section */}
              <div className="bg-gray-50 p-6 rounded-2xl mb-8 border-2 border-dashed border-gray-300">
                <h3 className="text-lg font-bold mb-2">OFERTA ESPECIAL</h3>
                <p className="text-md font-semibold mb-1">15% OFF en Camisa Blanca</p>
                <p className="text-sm text-gray-600">Válido por 30 minutos.</p>
              </div>

              <div className="space-y-4 w-full">
                <Button onClick={handleAcceptSpecialDiscount} className="w-full bg-purple-600 text-white rounded-2xl py-4">
                  Aceptar el descuento
                </Button>
              </div>
            </div>
          </div>

          <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
        </div>
      );
    }

    // Rejected - with attempts remaining
    return (
      <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
        <div className="max-w-md mx-auto w-full">
          {/* Header with Menu and Exit */}
          <div className="flex justify-between items-center mb-4">
            <HamburgerMenu />
            <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
              <X size={24} />
            </Button>
          </div>

          <div className="flex-1 flex flex-col justify-center text-center px-4">
            {/* Minimalist sad/disappointed emoji */}
            <div className="text-6xl mb-6">☹</div>
            
            <h1 className="text-xl font-bold mb-4">No pudimos aceptar esa oferta</h1>
            
            {/* Updated tip copy */}
            <div className="text-center mb-6">
              <p className="text-sm" style={{
                color: '#D5B4F7'
              }}>
                <span className="font-semibold">#Tip</span>
              </p>
              <p className="text-gray-600 text-sm">
                Probá subir un poquito tu oferta: a veces, un pequeño ajuste hace toda la diferencia.
              </p>
            </div>
            
            <p className="text-sm text-yellow-600 mb-8">
              {attemptsRemaining === 1 ? 'Te queda 1 intento' : `Te quedan ${attemptsRemaining} intentos`}
            </p>

            <Button
              onClick={() => setCurrentScreen('offer')}
              className="w-full bg-purple-600 text-white rounded-2xl py-4"
            >
              Hacer nueva oferta
            </Button>
          </div>
        </div>

        <ConfirmExitDialog open={showExitDialog} onClose={() => setShowExitDialog(false)} onConfirm={handleExit} />
      </div>
    );
  }

  // Coupons Screen
  if (currentScreen === 'coupons') {
    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
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
