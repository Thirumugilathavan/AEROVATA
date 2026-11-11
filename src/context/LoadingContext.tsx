import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { ActiveOperation } from '../types/loading';

interface LoadingContextType {
  operations: ActiveOperation[];
  isBusy: (id?: string) => boolean;
  startOperation: (
    id: string,
    label: string,
    scope?: 'global' | 'map' | 'action',
    cancellable?: boolean,
    onCancel?: () => void
  ) => void;
  updateOperation: (id: string, progress?: number, label?: string) => void;
  finishOperation: (id: string) => void;
  cancelOperation: (id: string) => void;
  activeMapOperation: ActiveOperation | null;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [operations, setOperations] = useState<ActiveOperation[]>([]);

  const startOperation = useCallback(
    (
      id: string,
      label: string,
      scope: 'global' | 'map' | 'action' = 'action',
      cancellable = false,
      onCancel?: () => void
    ) => {
      setOperations((prev) => {
        const filtered = prev.filter((op) => op.id !== id);
        return [
          ...filtered,
          {
            id,
            label,
            scope,
            cancellable,
            onCancel,
            startedAt: Date.now(),
          },
        ];
      });
    },
    []
  );

  const updateOperation = useCallback((id: string, progress?: number, label?: string) => {
    setOperations((prev) =>
      prev.map((op) => {
        if (op.id !== id) return op;
        return {
          ...op,
          ...(progress !== undefined ? { progress } : {}),
          ...(label !== undefined ? { label } : {}),
        };
      })
    );
  }, []);

  const finishOperation = useCallback((id: string) => {
    setOperations((prev) => prev.filter((op) => op.id !== id));
  }, []);

  const cancelOperation = useCallback((id: string) => {
    setOperations((prev) => {
      const op = prev.find((o) => o.id === id);
      if (op && op.onCancel) {
        try {
          op.onCancel();
        } catch (_) {}
      }
      return prev.filter((o) => o.id !== id);
    });
  }, []);

  const isBusy = useCallback(
    (id?: string) => {
      if (!id) return operations.length > 0;
      return operations.some((op) => op.id === id);
    },
    [operations]
  );

  const activeMapOperation = useMemo(() => {
    return operations.find((op) => op.scope === 'map') || null;
  }, [operations]);

  const value = useMemo(
    () => ({
      operations,
      isBusy,
      startOperation,
      updateOperation,
      finishOperation,
      cancelOperation,
      activeMapOperation,
    }),
    [operations, isBusy, startOperation, updateOperation, finishOperation, cancelOperation, activeMapOperation]
  );

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
};

export const useLoading = (): LoadingContextType => {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    // Graceful fallback if invoked outside provider
    return {
      operations: [],
      isBusy: () => false,
      startOperation: () => {},
      updateOperation: () => {},
      finishOperation: () => {},
      cancelOperation: () => {},
      activeMapOperation: null,
    };
  }
  return ctx;
};
