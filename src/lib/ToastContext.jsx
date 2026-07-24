import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
  }, []);

  const push = useCallback(
    (message, type) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message, type }]);
      timersRef.current.set(
        id,
        setTimeout(() => remove(id), 3400)
      );
    },
    [remove]
  );

  const apiRef = useRef({
    success: (message) => push(message, "success"),
    error: (message) => push(message, "error"),
  });

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      <div className="nx-toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`nx-toast nx-toast-${t.type}`}>
            {t.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} aria-label="Dismiss notification">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
