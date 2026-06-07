'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  options: { name: string; priceModifier: number }[];
  imageUrl: string | null;
}

interface CartState {
  items: CartItem[];
  tenantSlug: string;
}

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItem }
  | { type: 'REMOVE_ITEM'; menuItemId: string }
  | { type: 'UPDATE_QUANTITY'; menuItemId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; items: CartItem[] };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.find(
        (i) => i.menuItemId === action.item.menuItemId
      );
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.menuItemId === action.item.menuItemId
              ? { ...i, quantity: i.quantity + action.item.quantity }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, action.item] };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.menuItemId !== action.menuItemId),
      };
    case 'UPDATE_QUANTITY':
      if (action.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(
            (i) => i.menuItemId !== action.menuItemId
          ),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.menuItemId === action.menuItemId
            ? { ...i, quantity: action.quantity }
            : i
        ),
      };
    case 'CLEAR':
      return { ...state, items: [] };
    case 'LOAD':
      return { ...state, items: action.items };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const CART_KEY = (slug: string) => `fafa_cart_${slug}`;

export function CartProvider({
  children,
  tenantSlug,
}: {
  children: ReactNode;
  tenantSlug: string;
}) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    tenantSlug,
  });

  // Load cart from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY(tenantSlug));
      if (stored) {
        const items = JSON.parse(stored) as CartItem[];
        dispatch({ type: 'LOAD', items });
      }
    } catch {
      // Ignore parse errors
    }
  }, [tenantSlug]);

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY(tenantSlug), JSON.stringify(state.items));
    } catch {
      // Ignore storage errors
    }
  }, [state.items, tenantSlug]);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: 'ADD_ITEM', item });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    dispatch({ type: 'REMOVE_ITEM', menuItemId });
  }, []);

  const updateQuantity = useCallback(
    (menuItemId: string, quantity: number) => {
      dispatch({ type: 'UPDATE_QUANTITY', menuItemId, quantity });
    },
    []
  );

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0);

  const subtotal = state.items.reduce((sum, item) => {
    const optionsTotal = item.options.reduce(
      (s, o) => s + o.priceModifier,
      0
    );
    return sum + (item.price + optionsTotal) * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        itemCount,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
