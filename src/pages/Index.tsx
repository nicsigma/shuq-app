import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ShoppingBag, Clock, CheckCircle, Menu, Camera, Receipt } from 'lucide-react';
import { ConfirmExitDialog } from '@/components/ConfirmExitDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

interface Coupon {
  id: string;
  productName: string;
  offeredPrice: number;
  expiresAt: Date;
  type: 'accepted' | 'special-discount';
  code: string;
  discountPercentage?: number; // For special discount coupons
}

const SAMPLE_PRODUCT: Product = {
  id: '1',
  name: 'CAMPERA AMERICANO NEGRO',
  price: 125000,
  image: '/lovable-uploads/8d13fdd4-4374-49ac-9e3d-a4898309bd29.png'
};

const ShuQApp = () => {
  const [currentScreen, setCurrentScreen] = useState<'loader' | 'onboarding' | 'offer' | 'result' | 'coupons' | 'camera'>('loader');
  const [selectedProduct] = useState<Product>(SAMPLE_PRODUCT);
  const [offerPrice, setOfferPrice] = useState<number>(75000);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [lastOfferResult, setLastOfferResult] = useState<'accepted' | 'rejected' | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showExitDialog, setShowExitDialog] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  // Auto-transition from loader to onboarding after 3 seconds
  useEffect(() => {
    if (currentScreen === 'loader') {
      const timer = setTimeout(() => {
        setCurrentScreen('onboarding');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  useEffect(() => {
    const savedCoupons = localStorage.getItem('shuq-coupons');
    if (savedCoupons) {
      const parsedCoupons = JSON.parse(savedCoupons).map((coupon: any) => ({
        ...coupon,
        expiresAt: new Date(coupon.expiresAt)
      }));
      setCoupons(parsedCoupons);
    }
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

  const handleSendOffer = () => {
    const minAcceptablePrice = selectedProduct.price * 0.6;
    const isAccepted = offerPrice >= minAcceptablePrice;
    
    if (isAccepted) {
      const newCoupon: Coupon = {
        id: Date.now().toString(),
        productName: selectedProduct.name,
        offeredPrice: offerPrice,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        type: 'accepted',
        code: generateCode()
      };
      saveCoupons([...coupons, newCoupon]);
      setLastOfferResult('accepted');
    } else {
      const newAttempts = attemptsRemaining - 1;
      setAttemptsRemaining(newAttempts);
      setLastOfferResult('rejected');
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

  const handleExit = () => {
    setShowExitDialog(false);
    resetFlow();
  };

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
              setCurrentScreen('coupons');
              setIsMenuOpen(false);
            }}
            variant="ghost"
            className="flex items-center gap-3 justify-start p-4 h-auto"
          >
            <Receipt size={20} />
            <span className="text-lg">Mis ofertas</span>
          </Button>
          <Button
            onClick={() => {
              setCurrentScreen('camera');
              setIsMenuOpen(false);
            }}
            variant="ghost"
            className="flex items-center gap-3 justify-start p-4 h-auto"
          >
            <Camera size={20} />
            <span className="text-lg">Escanear nuevo producto</span>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );

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
              onClick={() => setCurrentScreen('offer')}
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

  // Camera Screen
  if (currentScreen === 'camera') {
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <HamburgerMenu />
            <h1 className="text-lg font-semibold">ShuQ</h1>
            <Button onClick={() => setShowExitDialog(true)} variant="ghost" className="p-2">
              <X size={24} />
            </Button>
          </div>

          <div className="flex flex-col justify-center text-center px-4 mt-16">
            <Camera size={80} className="mx-auto mb-8 text-gray-400" />
            <h2 className="text-2xl font-bold mb-4">Escaneá el código QR</h2>
            <p className="text-gray-600 mb-8">Apuntá la cámara al código QR de la prenda que querés ofertar</p>
            
            <Button
              onClick={() => setCurrentScreen('offer')}
              className="w-full px-8 py-4 text-lg rounded-2xl mb-4"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              Simular escaneo
            </Button>
            
            <Button onClick={() => setCurrentScreen('onboarding')} variant="outline" className="w-full rounded-2xl py-4">
              Volver
            </Button>
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
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="w-full h-full object-cover object-center"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg></div>';
                }}
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
                <Button onClick={resetFlow} className="w-full bg-purple-600 text-white rounded-2xl py-4">
                  Hacer otra oferta
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
              <Button onClick={resetFlow} className="bg-purple-600 text-white rounded-2xl px-6 py-3">
                Crear oferta
              </Button>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {activeCoupons.map(coupon => {
                // Special discount coupon styling
                if (coupon.type === 'special-discount') {
                  return (
                    <Card key={coupon.id} className="p-4 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50">
                      <div className="flex items-center gap-4">
                        {/* Special discount icon */}
                        <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">🎁</span>
                        </div>
                        
                        {/* Product Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-bold">ESPECIAL</span>
                          </div>
                          <h3 className="font-semibold text-sm">{coupon.productName}</h3>
                          <p className="text-lg font-bold text-purple-600">
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
                        <img
                          src={selectedProduct.image}
                          alt={coupon.productName}
                          className="w-full h-full object-cover object-center"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="flex items-center justify-center w-full h-full"><svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path></svg></div>';
                          }}
                        />
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
