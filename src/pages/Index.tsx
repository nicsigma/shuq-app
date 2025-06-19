import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, ShoppingBag, Clock, CheckCircle } from 'lucide-react';
import { ConfirmExitDialog } from '@/components/ConfirmExitDialog';

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
  id: '3', 
  name: 'Remera Oversize', 
  price: 25000, 
  image: '/placeholder.svg'
};

const ShuQApp = () => {
  const [currentScreen, setCurrentScreen] = useState<'splash' | 'offer' | 'result' | 'coupons' | 'checkout'>('splash');
  const [selectedProduct] = useState<Product>(SAMPLE_PRODUCT);
  const [offerPrice, setOfferPrice] = useState<number>(15000);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [lastOfferResult, setLastOfferResult] = useState<'accepted' | 'rejected' | 'fallback' | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showSecondProduct, setShowSecondProduct] = useState<boolean>(false);
  const [showExitDialog, setShowExitDialog] = useState<boolean>(false);

  // Load coupons from localStorage on mount
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

  // Save coupons to localStorage
  const saveCoupons = (newCoupons: Coupon[]) => {
    setCoupons(newCoupons);
    localStorage.setItem('shuq-coupons', JSON.stringify(newCoupons));
  };

  const generateCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  const getAttemptColor = () => {
    if (attemptsRemaining === 3) return 'bg-green-100 text-green-800';
    if (attemptsRemaining === 2) return 'bg-yellow-100 text-yellow-800';
    return 'bg-orange-100 text-orange-800';
  };

  const getAttemptText = () => {
    if (attemptsRemaining === 1) return 'Te queda 1 intento';
    return `Te quedan ${attemptsRemaining} intentos`;
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

  const resetFlow = () => {
    setOfferPrice(15000);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    setShowSecondProduct(false);
    setCurrentScreen('splash');
  };

  const handleExit = () => {
    setShowExitDialog(false);
    resetFlow();
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
            <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <ShoppingBag size={32} className="text-gray-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">{selectedProduct.name}</h2>
              <p className="text-gray-600">Precio oficial: ${selectedProduct.price.toLocaleString()}</p>
            </div>
          </div>

          {/* Attempts Indicator */}
          <div className="mb-6">
            <div className={`inline-block px-4 py-2 rounded-lg ${getAttemptColor()}`}>
              <span className="text-sm font-medium">{getAttemptText()}</span>
            </div>
          </div>

          {/* Offer Section */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold mb-4">¿Cuánto querés pagar?</h3>
              <input
                type="range"
                min={selectedProduct.price * 0.3}
                max={selectedProduct.price}
                value={offerPrice}
                onChange={(e) => setOfferPrice(Number(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>${Math.floor(selectedProduct.price * 0.3).toLocaleString()}</span>
                <span>${selectedProduct.price.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">Ingresá el monto manualmente</p>
              <input
                type="number"
                value={offerPrice}
                onChange={(e) => setOfferPrice(Number(e.target.value))}
                className="w-full p-4 border border-gray-300 rounded-2xl text-center text-2xl font-bold"
                placeholder="Ingresá tu oferta"
              />
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

  // Result Screen
  if (currentScreen === 'result') {
    if (lastOfferResult === 'accepted') {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
          <div className="max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
            <CheckCircle size={80} className="text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">Tu oferta fue aceptada</h1>
            <p className="text-gray-600 mb-8">
              Compraste {selectedProduct?.name} por ${offerPrice.toLocaleString()}
            </p>

            {showSecondProduct && (
              <Card className="p-6 rounded-2xl mb-6 bg-yellow-50">
                <h3 className="font-bold mb-2">Hoy estás de suerte</h3>
                <p className="text-sm mb-4">
                  Agregá un 20% de descuento en un segundo producto
                </p>
              </Card>
            )}

            <div className="space-y-4">
              <Button 
                onClick={handleAddSecondProduct}
                className="w-full bg-purple-600 text-white rounded-2xl py-4"
              >
                Agregar producto
              </Button>
              <Button 
                onClick={() => setCurrentScreen('coupons')}
                variant="outline"
                className="w-full rounded-2xl py-4 border-purple-600 text-purple-600"
              >
                No, gracias
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (lastOfferResult === 'fallback') {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
          <div className="max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
            <div className="text-6xl mb-6">😔</div>
            <h1 className="text-xl font-bold mb-4">Tu oferta no fue aceptada</h1>
            <p className="text-gray-600 mb-6">
              Pero ganaste un 15% OFF en esta prenda para no irte con las manos vacías
            </p>

            <Card className="p-6 rounded-2xl mb-6 bg-blue-50">
              <h3 className="font-bold mb-2">Descuento especial</h3>
              <p className="text-lg">15% OFF en {selectedProduct?.name}</p>
              <p className="text-sm text-gray-600 mt-2">Válido por 30 minutos</p>
            </Card>

            <div className="space-y-4">
              <Button 
                onClick={() => setCurrentScreen('coupons')}
                className="w-full bg-purple-600 text-white rounded-2xl py-4"
              >
                Aceptar descuento
              </Button>
              <Button 
                onClick={resetFlow}
                variant="outline"
                className="w-full rounded-2xl py-4 border-purple-600 text-purple-600"
              >
                Salir
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Rejected
    return (
      <div className="min-h-screen bg-white p-4 flex flex-col font-roboto">
        <div className="max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
          <div className="text-6xl mb-6">😔</div>
          <h1 className="text-xl font-bold mb-4">No pudimos aceptar esa oferta</h1>
          <p className="text-gray-600 mb-2">Probá un poquito más alto</p>
          <p className="text-sm text-yellow-600 mb-8">
            Te quedan {attemptsRemaining} intentos
          </p>

          <div className="space-y-4">
            <Button 
              onClick={() => setCurrentScreen('offer')}
              className="w-full bg-purple-600 text-white rounded-2xl py-4"
            >
              Intentar de nuevo
            </Button>
            <Button 
              onClick={resetFlow}
              className="w-full rounded-2xl py-4 bg-gray-600 text-white"
            >
              Finalizar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Coupons Screen
  if (currentScreen === 'coupons') {
    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-white p-4 font-roboto">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Mis Cupones</h1>
            <Button 
              onClick={resetFlow}
              variant="outline"
              className="rounded-full border-purple-600 text-purple-600"
            >
              Nuevo
            </Button>
          </div>

          {activeCoupons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No tenés cupones activos</p>
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
                  <div className="bg-gray-100 p-3 rounded-xl">
                    <p className="text-xs text-gray-600 mb-1">Código:</p>
                    <p className="font-mono font-bold text-lg">{coupon.code}</p>
                  </div>
                  <Button 
                    onClick={() => setCurrentScreen('checkout')}
                    className="w-full mt-3 bg-purple-600 text-white rounded-xl py-2"
                  >
                    Usar en caja
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Checkout Screen
  if (currentScreen === 'checkout') {
    const activeCoupons = coupons.filter(coupon => new Date() < coupon.expiresAt);
    
    return (
      <div className="min-h-screen bg-black text-white p-4 font-roboto">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-6 pt-8">Mostrar en Caja</h1>
          
          {activeCoupons.map((coupon) => (
            <Card key={coupon.id} className="p-6 rounded-2xl mb-6 bg-white text-black">
              <h2 className="text-xl font-bold mb-2">{coupon.productName}</h2>
              <p className="text-2xl font-bold text-green-600 mb-4">
                ${coupon.offeredPrice.toLocaleString()}
              </p>
              <div className="bg-gray-100 p-4 rounded-xl mb-4">
                <p className="text-4xl font-mono font-bold">{coupon.code}</p>
              </div>
              <TimeDisplay expiresAt={coupon.expiresAt} />
            </Card>
          ))}

          <Button 
            onClick={() => setCurrentScreen('coupons')}
            variant="outline"
            className="w-full rounded-2xl py-4 border-white text-white hover:bg-white hover:text-black"
          >
            Volver a cupones
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

export default ShuQApp;
