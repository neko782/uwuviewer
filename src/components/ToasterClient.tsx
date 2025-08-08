"use client";
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';

export default function ToasterClient() {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <Toaster
      richColors
      position={isMobile ? 'bottom-center' : 'top-right'}
      expand={true}
      closeButton
      toastOptions={{
        duration: 4000,
        style: { fontSize: '14px', lineHeight: '1.4' },
        classNames: {
          title: 'toast-title',
          description: 'toast-description',
        },
      }}
    />
  );
}
