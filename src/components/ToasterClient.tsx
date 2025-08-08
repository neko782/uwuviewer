"use client";
import { Toaster } from 'sonner';

export default function ToasterClient() {
  return (
    <Toaster
      richColors
      position="top-right"
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
