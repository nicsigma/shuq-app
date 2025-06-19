import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ShoppingBag, Clock, CheckCircle } from 'lucide-react';
import { ConfirmExitDialog } from '@/components/ConfirmExitDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  type: 'accepted' | 'fallback' | 'second';
  code: string;
}

const SAMPLE_PRODUCT: Product = {
  id: '1', 
  name: 'CAMPERA AMERICANO NEGRO', 
  price: 125000, 
  image: '/lovable-uploads/8d13fdd4-4374-49ac-9e3d-a4898309bd29.png'
};

const ShuQApp = () => {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'offer' | 'result' | 'coupons' | 'checkout'>('splash');
  const [selectedProduct] = useState<Product>(SAMPLE_PRODUCT);
  const [offerPrice, setOfferPrice] = useState<number>(75000);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [lastOfferResult, setLastOfferResult] = useState<'accepted' | 'rejected' | 'fallback' | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showSecondProduct, setShowSecondProduct] = useState<boolean>(false);
  const [showExitDialog, setShowExitDialog] = useState<boolean>(false);
  const [showContinueDialog, setShowContinueDialog] = useState<boolean>(false);

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
      setShowSecondProduct(true);
    } else {
      const newAttempts = attemptsRemaining - 1;
      setAttemptsRemaining(newAttempts);
      
      if (newAttempts === 0) {
        // Fallback offer
        const fallbackCoupon: Coupon = {
          id: Date.now().toString(),
          productName: selectedProduct.name,
          offeredPrice: selectedProduct.price * 0.85,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          type: 'fallback',
          code: generateCode()
        };
        saveCoupons([...coupons, fallbackCoupon]);
        setLastOfferResult('fallback');
      } else {
        setLastOfferResult('rejected');
      }
    }
    setCurrentScreen('result');
  };

  const resetFlow = () => {
    setOfferPrice(75000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    setShowSecondProduct(false);
    setCurrentScreen('splash');
  };

  const handleExit = () => {
    setShowExitDialog(false);
    resetFlow();
  };

  const handleAddSecondProduct = () => {
    const secondProductCoupon: Coupon = {
      id: Date.now().toString(),
      productName: 'Producto Adicional (20% OFF)',
      offeredPrice: 12000,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      type: 'second',
      code: generateCode()
    };
    saveCoupons([...coupons, secondProductCoupon]);
    setCurrentScreen('coupons');
  };

  const TimeDisplay = ({ expiresAt }: { expiresAt: Date }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
      const timer = setInterval(() => {
        const now = new Date().getTime();
        const expiry = expiresAt.getTime();
        const difference = expiry - now;

        if (difference > 0) {
          const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((difference % (1000 * 60)) / 1000);
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

  const handleContinueWithPurchase = () => {
    setShowContinueDialog(true);
  };

  const handleContinueDialogYes = () => {
    setShowContinueDialog(false);
    resetFlow();
  };

  const handleContinueDialogNo = () => {
    setShowContinueDialog(false);
    setCurrentScreen('coupons');
  };

  // Splash Screen
  if (currentScreen === 'splash') {
    return (
      <div className="min-h-screen bg-white p-4 font-roboto flex flex-col justify-center items-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">ShuQ</h1>
          <p className="text-xl text-gray-600">Vos elegís la prenda... Y el precio ;)</p>
          <Button 
            onClick={() => setCurrentScreen('offer')}
            className="mt-8 px-8 py-4 text-lg rounded-2xl"
            style={{ backgroundColor: '#B5FFA3', color: '#000' }}
          >
            Comenzar
          </Button>
        </div>
      </div>
    );
  }

  // Offer Screen
  if (currentScreen === 'offer') {
    const discountPercentage = Math.round(((selectedProduct.price - offerPrice) / selectedProduct.price) * 100);
    
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          {/* Exit Button */}
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setShowExitDialog(true)}
              variant="ghost"
              className="p-2"
            >
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
                onError={(e) => {
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
                  onChange={(e) => setOfferPrice(Number(e.target.value))}
                  className="w-full ultra-thin-slider"
                  style={{
                    background: `linear-gradient(to right, #D5B4F7 0%, #D5B4F7 ${(offerPrice / selectedProduct.price) * 100}%, #e5e7eb ${(offerPrice / selectedProduct.price) * 100}%, #e5e7eb 100%)`
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
                onChange={(e) => setOfferPrice(Number(e.target.value))}
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
              style={{ backgroundColor: '#B5FFA3', color: '#000' }}
            >
              Ofertar
            </Button>
          </div>
        </div>

        <ConfirmExitDialog 
          open={showExitDialog}
          onClose={() => setShowExitDialog(false)}
          onConfirm={handleExit}
        />
      </div>
    );
  }

  if (currentScreen === 'result') {
    if (lastOfferResult === 'accepted') {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
          <div className="max-w-md mx-auto">
            {/* Exit Button */}
            <div className="flex justify-end mb-4">
              <Button 
                onClick={() => setShowExitDialog(true)}
                variant="ghost"
                className="p-2"
              >
                <X size={24} />
              </Button>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center">
              {/* Linear minimalist smiley emoji */}
              <div className="text-6xl mb-6">☺</div>
            
              <h1 className="text-2xl font-bold mb-4">¡Tu oferta fue aceptada!</h1>
              <p className="text-gray-600 mb-8">
                {selectedProduct?.name} por ${offerPrice.toLocaleString()}
              </p>

              <Card className="p-6 rounded-2xl mb-6 bg-yellow-50">
                <h3 className="font-bold mb-2">Hoy estás de suerte</h3>
                <p className="text-sm mb-4">
                  Te ganaste un 20% OFF en otra prenda. ¡Escaneá para elegirla!
                </p>
              </Card>

              <div className="space-y-4">
                <Button 
                  onClick={() => {
                    setShowSecondProduct(false);
                    resetFlow();
                  }}
                  className="w-full bg-purple-600 text-white rounded-2xl py-4"
                >
                  Escanear nueva prenda
                </Button>
                <Button 
                  onClick={handleContinueWithPurchase}
                  variant="outline"
                  className="w-full rounded-2xl py-4 border-purple-600 text-purple-600"
                >
                  Continuar con mi compra
                </Button>
              </div>
            </div>
          </div>

          <ConfirmExitDialog 
            open={showExitDialog}
            onClose={() => setShowExitDialog(false)}
            onConfirm={handleExit}
          />

          <AlertDialog open={showContinueDialog} onOpenChange={setShowContinueDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Querés hacer otra oferta antes de pagar?
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleContinueDialogNo}>
                  No
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleContinueDialogYes}>
                  Sí
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }

    if (lastOfferResult === 'fallback') {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
          <div className="max-w-md mx-auto">
            {/* Exit Button */}
            <div className="flex justify-end mb-4">
              <Button 
                onClick={() => setShowExitDialog(true)}
                variant="ghost"
                className="p-2"
              >
                <X size={24} />
              </Button>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center">
              {/* Minimalist sad emoji */}
              <div className="text-6xl mb-6">☹</div>
              
              <h1 className="text-xl font-bold mb-4">Tu oferta no fue aceptada</h1>
              <p className="text-gray-600 mb-6">
                Pero te regalamos un descuento para no irte con las manos vacías
              </p>

              <Card className="p-6 rounded-2xl mb-6 bg-blue-50">
                <h3 className="font-bold mb-3">OFERTA ESPECIAL</h3>
                <p className="text-lg mb-1">15% OFF en {selectedProduct?.name}</p>
                <p className="text-sm text-gray-600">Válido por 30 minutos</p>
              </Card>

              <Button 
                onClick={() => setCurrentScreen('coupons')}
                className="w-full bg-purple-600 text-white rounded-2xl py-4"
              >
                Aceptar descuento
              </Button>
            </div>
          </div>

          <ConfirmExitDialog 
            open={showExitDialog}
            onClose={() => setShowExitDialog(false)}
            onConfirm={handleExit}
          />
        </div>
      );
    }

    // Rejected
    return (
      <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
        <div className="max-w-md mx-auto">
          {/* Exit Button */}
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setShowExitDialog(true)}
              variant="ghost"
              className="p-2"
            >
              <X size={24} />
            </Button>
          </div>

          <div className="flex-1 flex flex-col justify-center text-center">
            {/* Minimalist sad/disappointed emoji */}
            <div className="text-6xl mb-6">☹</div>
            
            <h1 className="text-xl font-bold mb-4">No pudimos aceptar esa oferta</h1>
            
            {/* Centered tip in lilac color */}
            <div className="text-center mb-6">
              <p className="text-sm" style={{ color: '#D5B4F7' }}>
                <span className="font-semibold">#Tip</span>
              </p>
              <p className="text-gray-600 text-sm">
                Una buena oferta no siempre es la más baja
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

        <ConfirmExitDialog 
          open={showExitDialog}
          onClose={() => setShowExitDialog(false)}
          onConfirm={handleExit}
        />
      </div>
    );
  }

  // Coupons Screen
  if (currentScreen === 'coupons') {
    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          {/* Exit Button */}
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setShowExitDialog(true)}
              variant="ghost"
              className="p-2"
            >
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
              <Button 
                onClick={resetFlow}
                className="bg-purple-600 text-white rounded-2xl px-6 py-3"
              >
                Crear oferta
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeCoupons.map((coupon) => (
                <Card key={coupon.id} className="p-4 rounded-2xl">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{coupon.productName}</h3>
                      <p className="text-lg font-bold text-green-600">
                        ${coupon.offeredPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <TimeDisplay expiresAt={coupon.expiresAt} />
                    </div>
                  </div>
                  <div className="bg-gray-100 p-3 rounded-xl mb-3">
                    <p className="text-xs text-gray-600 mb-1">Código</p>
                    <p className="font-mono font-bold text-lg">{coupon.code}</p>
                  </div>
                  <Button 
                    onClick={() => setCurrentScreen('checkout')}
                    className="w-full bg-purple-600 text-white rounded-xl py-2"
                  >
                    Mostrar en caja
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>

        <ConfirmExitDialog 
          open={showExitDialog}
          onClose={() => setShowExitDialog(false)}
          onConfirm={handleExit}
        />
      </div>
    );
  }

  // Checkout Screen
  if (currentScreen === 'checkout') {
    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-black text-white p-4 font-roboto pb-24">
        <div className="max-w-md mx-auto">
          {/* Exit Button */}
          <div className="flex justify-end mb-4">
            <Button 
              onClick={() => setShowExitDialog(true)}
              variant="ghost"
              className="p-2 text-white hover:bg-white/10"
            >
              <X size={24} />
            </Button>
          </div>

          <h1 className="text-2xl font-bold mb-8 text-center">Mostrá en caja tus ofertas</h1>
          
          <div className="space-y-6">
            {activeCoupons.map((coupon) => (
              <Card key={coupon.id} className="p-6 rounded-2xl bg-white text-black">
                <h2 className="text-xl font-bold mb-2">{coupon.productName}</h2>
                <p className="text-2xl font-bold text-green-600 mb-4">
                  ${coupon.offeredPrice.toLocaleString()}
                </p>
                <div className="bg-gray-100 p-4 rounded-xl mb-4">
                  <p className="text-4xl font-mono font-bold text-center">{coupon.code}</p>
                </div>
                <div className="flex justify-center">
                  <TimeDisplay expiresAt={coupon.expiresAt} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Fixed CTA Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black">
          <div className="max-w-md mx-auto">
            <Button 
              onClick={() => setCurrentScreen('coupons')}
              className="w-full rounded-2xl py-4 text-black font-medium"
              style={{ backgroundColor: '#B5FFA3' }}
            >
              Volver a ofertas
            </Button>
          </div>
        </div>

        <ConfirmExitDialog 
          open={showExitDialog}
          onClose={() => setShowExitDialog(false)}
          onConfirm={handleExit}
        />
      </div>
    );
  }

  return null;
};

export default ShuQApp;
