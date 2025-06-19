
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, ShoppingBag, Clock, CheckCircle, X } from 'lucide-react';

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

const PRODUCTS: Product[] = [
  { id: '1', name: 'Camisa Blanca', price: 25000, image: '/placeholder.svg' },
  { id: '2', name: 'Pantalón Slim', price: 30000, image: '/placeholder.svg' },
  { id: '3', name: 'Remera Oversize', price: 15000, image: '/placeholder.svg' }
];

const ShuQApp = () => {
  const [currentScreen, setCurrentScreen] = useState<'entry' | 'onboarding' | 'offer' | 'result' | 'coupons' | 'checkout'>('entry');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [offerPrice, setOfferPrice] = useState<number>(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number>(3);
  const [lastOfferResult, setLastOfferResult] = useState<'accepted' | 'rejected' | 'fallback' | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [showSecondProduct, setShowSecondProduct] = useState<boolean>(false);

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

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setOfferPrice(Math.floor(product.price * 0.6));
    setCurrentScreen('onboarding');
  };

  const handleSendOffer = () => {
    if (!selectedProduct) return;

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
    if (!selectedProduct) return;
    
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
    setSelectedProduct(null);
    setOfferPrice(0);
    setAttemptsRemaining(3);
    setLastOfferResult(null);
    setShowSecondProduct(false);
    setCurrentScreen('entry');
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

  // Entry Screen
  if (currentScreen === 'entry') {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8 pt-8">
            <h1 className="text-3xl font-bold mb-2">ShuQ</h1>
            <p className="text-gray-600">Simulador de Escaneo QR</p>
            <p className="text-sm text-gray-500 mt-2">Seleccioná un producto para comenzar</p>
          </div>

          <div className="space-y-4">
            {PRODUCTS.map((product) => (
              <Card key={product.id} className="p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{product.name}</h3>
                    <p className="text-gray-600">${product.price.toLocaleString()}</p>
                  </div>
                  <Button 
                    onClick={() => handleProductSelect(product)}
                    className="rounded-full bg-black text-white hover:bg-gray-800"
                  >
                    <ArrowRight size={20} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <Button 
              onClick={() => setCurrentScreen('coupons')}
              variant="outline"
              className="w-full rounded-2xl py-6 text-lg border-black"
            >
              Ver Mis Cupones
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding Screen
  if (currentScreen === 'onboarding') {
    return (
      <div className="min-h-screen bg-white p-4 flex flex-col">
        <div className="max-w-md mx-auto flex-1 flex flex-col justify-center">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-6">¡Negociemos!</h1>
            
            <div className="space-y-4 text-left bg-gray-50 p-6 rounded-2xl">
              <p className="flex items-start gap-3">
                <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</span>
                Tenés 3 chances para proponer tu precio
              </p>
              <p className="flex items-start gap-3">
                <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</span>
                Usá el slider o ingresá el valor manualmente
              </p>
              <p className="flex items-start gap-3">
                <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</span>
                Enviá tu oferta para ver si es aceptada
              </p>
              <p className="flex items-start gap-3">
                <span className="bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">4</span>
                Si es aceptada, mostrá el código en caja
              </p>
            </div>
          </div>

          <Button 
            onClick={() => setCurrentScreen('offer')}
            className="w-full bg-black text-white rounded-2xl py-6 text-lg hover:bg-gray-800"
          >
            ¡Empezar!
          </Button>
        </div>
      </div>
    );
  }

  // Offer Screen
  if (currentScreen === 'offer' && selectedProduct) {
    return (
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-6">
            <Card className="p-6 rounded-2xl">
              <div className="bg-gray-100 rounded-xl h-48 mb-4 flex items-center justify-center">
                <ShoppingBag size={48} className="text-gray-500" />
              </div>
              <h2 className="text-xl font-bold mb-2">{selectedProduct.name}</h2>
              <p className="text-gray-600 mb-4">Precio oficial: ${selectedProduct.price.toLocaleString()}</p>
              <p className="text-sm bg-yellow-100 text-yellow-800 p-2 rounded-lg">
                Te quedan {attemptsRemaining} intentos
              </p>
            </Card>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Tu oferta:</label>
              <input
                type="range"
                min={selectedProduct.price * 0.3}
                max={selectedProduct.price}
                value={offerPrice}
                onChange={(e) => setOfferPrice(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>${Math.floor(selectedProduct.price * 0.3).toLocaleString()}</span>
                <span>${selectedProduct.price.toLocaleString()}</span>
              </div>
            </div>

            <div>
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
                {((offerPrice / selectedProduct.price) * 100).toFixed(0)}% del precio original
              </p>
            </div>

            <Button 
              onClick={handleSendOffer}
              className="w-full bg-black text-white rounded-2xl py-6 text-lg hover:bg-gray-800"
            >
              Enviar mi oferta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Result Screen
  if (currentScreen === 'result') {
    if (lastOfferResult === 'accepted') {
      return (
        <div className="min-h-screen bg-white p-4 flex flex-col">
          <div className="max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
            <CheckCircle size={80} className="text-green-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold mb-4">¡Tu oferta fue aceptada! 🎉</h1>
            <p className="text-gray-600 mb-8">
              Compraste {selectedProduct?.name} por ${offerPrice.toLocaleString()}
            </p>

            {showSecondProduct && (
              <Card className="p-6 rounded-2xl mb-6 bg-yellow-50">
                <h3 className="font-bold mb-2">¡Oferta especial!</h3>
                <p className="text-sm mb-4">
                  Agregá un segundo producto con 20% de descuento
                  <br />
                  <span className="text-xs text-gray-500">Válido por 30 minutos</span>
                </p>
                <div className="bg-white p-4 rounded-xl">
                  <p className="font-medium">Producto Adicional</p>
                  <p className="text-green-600">$12.000 (20% OFF)</p>
                </div>
              </Card>
            )}

            <div className="space-y-4">
              <Button 
                onClick={handleAddSecondProduct}
                className="w-full bg-black text-white rounded-2xl py-4"
              >
                Agregar producto
              </Button>
              <Button 
                onClick={() => setCurrentScreen('coupons')}
                variant="outline"
                className="w-full rounded-2xl py-4 border-black"
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
        <div className="min-h-screen bg-white p-4 flex flex-col">
          <div className="max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
            <div className="text-6xl mb-6">😓</div>
            <h1 className="text-xl font-bold mb-4">Tus ofertas no fueron aceptadas</h1>
            <p className="text-gray-600 mb-6">
              Pero acá tenés un descuento de consolación
            </p>

            <Card className="p-6 rounded-2xl mb-6 bg-blue-50">
              <h3 className="font-bold mb-2">Descuento especial</h3>
              <p className="text-lg">15% OFF en {selectedProduct?.name}</p>
              <p className="text-sm text-gray-600 mt-2">Válido por 30 minutos</p>
            </Card>

            <div className="space-y-4">
              <Button 
                onClick={() => setCurrentScreen('coupons')}
                className="w-full bg-black text-white rounded-2xl py-4"
              >
                Aceptar descuento
              </Button>
              <Button 
                onClick={resetFlow}
                variant="outline"
                className="w-full rounded-2xl py-4 border-black"
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
      <div className="min-h-screen bg-white p-4 flex flex-col">
        <div className="max-w-md mx-auto flex-1 flex flex-col justify-center text-center">
          <X size={80} className="text-red-500 mx-auto mb-6" />
          <h1 className="text-xl font-bold mb-4">No pudimos aceptar esa oferta</h1>
          <p className="text-gray-600 mb-2">Probá un poquito más alto 😉</p>
          <p className="text-sm text-yellow-600 mb-8">
            Te quedan {attemptsRemaining} intentos
          </p>

          <div className="space-y-4">
            <Button 
              onClick={() => setCurrentScreen('offer')}
              className="w-full bg-black text-white rounded-2xl py-4"
            >
              Intentar de nuevo
            </Button>
            <Button 
              onClick={resetFlow}
              variant="outline"
              className="w-full rounded-2xl py-4 border-black"
            >
              Salir
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
      <div className="min-h-screen bg-white p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Mis Cupones</h1>
            <Button 
              onClick={resetFlow}
              variant="outline"
              className="rounded-full border-black"
            >
              Nuevo
            </Button>
          </div>

          {activeCoupons.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No tenés cupones activos</p>
              <Button 
                onClick={resetFlow}
                className="bg-black text-white rounded-2xl px-6 py-3"
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
                    className="w-full mt-3 bg-black text-white rounded-xl py-2"
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
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-2xl font-bold mb-6 pt-8">Mostrar en Caja</h1>
          
          {activeCoupons.map((coupon, index) => (
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
