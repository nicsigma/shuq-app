// This is a JavaScript script to fix the Index.tsx file

const fs = require('fs');

// Read the current file
const content = fs.readFileSync('src/pages/Index.tsx', 'utf8');

// Make all the necessary replacements
let updatedContent = content
  // Add useSearchParams import
  .replace(
    "import { useParams, useNavigate } from 'react-router-dom';",
    "import { useParams, useNavigate, useSearchParams } from 'react-router-dom';"
  )
  // Add search params detection after the navigate line
  .replace(
    "const navigate = useNavigate();",
    `const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQRSimulation = searchParams.get('qr') === 'true';`
  )
  // Add auto-advance logic for QR simulations by replacing the onboarding button click
  .replace(
    `<Button
              onClick={() => setCurrentScreen('offer')}
              className="w-full rounded-2xl py-6 text-lg"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              ¡Empecemos!
            </Button>`,
    `<Button
              onClick={() => setCurrentScreen('offer')}
              className="w-full rounded-2xl py-6 text-lg"
              style={{
                backgroundColor: '#B5FFA3',
                color: '#000'
              }}
            >
              ¡Empecemos!
            </Button>`
  )
  // Add auto-advance effect after the existing effects
  .replace(
    `}, [currentScreen, selectedProduct, isLoadingProduct]);`,
    `}, [currentScreen, selectedProduct, isLoadingProduct]);

  // Auto-advance from onboarding to offer for QR simulations
  useEffect(() => {
    if (currentScreen === 'onboarding' && isQRSimulation && selectedProduct && sku) {
      const timer = setTimeout(() => {
        setCurrentScreen('offer');
      }, 2000); // Show onboarding for 2 seconds, then go to offer
      return () => clearTimeout(timer);
    }
  }, [currentScreen, isQRSimulation, selectedProduct, sku]);`
  )
  // Update the camera screen buttons to include ?qr=true
  .replace(
    `onClick={() => navigate('/products/5208GT')}`,
    `onClick={() => navigate('/products/5208GT?qr=true')}`
  )
  .replace(
    `onClick={() => navigate('/products/5207NE')}`,
    `onClick={() => navigate('/products/5207NE?qr=true')}`
  );

// Write the updated content
fs.writeFileSync('src/pages/Index.tsx', updatedContent);
console.log('File updated successfully!');
