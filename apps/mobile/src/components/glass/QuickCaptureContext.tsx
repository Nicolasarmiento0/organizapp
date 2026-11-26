import React, { createContext, useCallback, useContext, useState } from 'react';
import type { QuickCaptureMode } from './QuickCaptureSheet';

interface QuickCaptureContextValue {
  isOpen: boolean;
  initialMode: QuickCaptureMode;
  openQuickCapture: (mode?: QuickCaptureMode) => void;
  closeQuickCapture: () => void;
}

const QuickCaptureContext = createContext<QuickCaptureContextValue>({
  isOpen: false,
  initialMode: 'task',
  openQuickCapture: () => {},
  closeQuickCapture: () => {},
});

export const QuickCaptureProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<QuickCaptureMode>('task');

  const openQuickCapture = useCallback((mode: QuickCaptureMode = 'task') => {
    setInitialMode(mode);
    setIsOpen(true);
  }, []);

  const closeQuickCapture = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <QuickCaptureContext.Provider
      value={{ isOpen, initialMode, openQuickCapture, closeQuickCapture }}
    >
      {children}
    </QuickCaptureContext.Provider>
  );
};

export function useQuickCapture(): QuickCaptureContextValue {
  return useContext(QuickCaptureContext);
}
