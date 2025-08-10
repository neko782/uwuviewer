import { useEffect, useCallback, useRef } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: KeyHandler;
  preventDefault?: boolean;
  enabled?: boolean;
  description?: string;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  stopPropagation?: boolean;
  target?: 'window' | 'document' | HTMLElement | null;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutConfig[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, stopPropagation = false, target = 'window' } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Skip if user is typing in an input field
    const activeElement = document.activeElement;
    if (
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true')
    ) {
      return;
    }

    for (const shortcut of shortcutsRef.current) {
      if (shortcut.enabled === false) continue;

      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       event.code.toLowerCase() === shortcut.key.toLowerCase();
      
      if (!keyMatch) continue;

      const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === event.ctrlKey;
      const altMatch = shortcut.alt === undefined || shortcut.alt === event.altKey;
      const shiftMatch = shortcut.shift === undefined || shortcut.shift === event.shiftKey;
      const metaMatch = shortcut.meta === undefined || shortcut.meta === event.metaKey;

      if (ctrlMatch && altMatch && shiftMatch && metaMatch) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
        shortcut.handler(event);
        break;
      }
    }
  }, [enabled, stopPropagation]);

  useEffect(() => {
    if (!enabled) return;

    let targetElement: Window | Document | HTMLElement | null = null;
    
    if (target === 'window') {
      targetElement = window;
    } else if (target === 'document') {
      targetElement = document;
    } else if (target instanceof HTMLElement) {
      targetElement = target;
    } else {
      return;
    }

    targetElement.addEventListener('keydown', handleKeyDown as EventListener);
    
    return () => {
      targetElement?.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, [enabled, handleKeyDown, target]);
}

// Helper hook for common navigation patterns
export function useArrowKeyNavigation(
  onUp?: () => void,
  onDown?: () => void,
  onLeft?: () => void,
  onRight?: () => void,
  options: UseKeyboardShortcutsOptions = {}
) {
  const shortcuts: ShortcutConfig[] = [];

  if (onUp) {
    shortcuts.push({
      key: 'ArrowUp',
      handler: onUp,
      description: 'Navigate up'
    });
  }

  if (onDown) {
    shortcuts.push({
      key: 'ArrowDown',
      handler: onDown,
      description: 'Navigate down'
    });
  }

  if (onLeft) {
    shortcuts.push({
      key: 'ArrowLeft',
      handler: onLeft,
      description: 'Navigate left/previous'
    });
  }

  if (onRight) {
    shortcuts.push({
      key: 'ArrowRight',
      handler: onRight,
      description: 'Navigate right/next'
    });
  }

  useKeyboardShortcuts(shortcuts, options);
}

// Export shortcut descriptions for help modal
export const KEYBOARD_SHORTCUTS = {
  viewer: [
    { keys: '←/→', description: 'Previous/Next image' },
    { keys: '↑/↓', description: 'Scroll info panel' },
    { keys: 'Escape', description: 'Close viewer' },
    { keys: 'F', description: 'Toggle fullscreen' },
    { keys: 'Space', description: 'Toggle zoom' },
    { keys: 'D', description: 'Download image' },
    { keys: 'C', description: 'Copy image URL' },
  ],
  gallery: [
    { keys: '←/→', description: 'Navigate images horizontally' },
    { keys: '↑/↓', description: 'Navigate images vertically' },
    { keys: 'Enter', description: 'Open selected image' },
    { keys: 'PageUp/PageDown', description: 'Previous/Next page' },
    { keys: 'Home/End', description: 'First/Last image' },
  ],
  global: [
    { keys: '/', description: 'Focus search bar' },
    { keys: 'H', description: 'Toggle header' },
    { keys: '?', description: 'Show keyboard shortcuts' },
    { keys: '1-5', description: 'Switch between sites' },
  ]
};