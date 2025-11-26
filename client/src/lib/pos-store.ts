import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Customer, Product, DayOperation } from '@shared/schema';

// Extended CartItem with storeId for multi-store support
interface ExtendedCartItem extends CartItem {
  storeId?: number | null;
}

interface POSState {
  // Cart state
  cartItems: ExtendedCartItem[];
  currentCustomer: Customer | null;
  currentStoreId: number | null; // Track current store in POS state
  
  // Day state
  currentDay: DayOperation | null;
  isDayOpen: boolean;
  selectedDate: string; // YYYY-MM-DD format for day operations
  
  // Transaction state
  currentTransactionNumber: string;
  resumedHeldTransactionId: number | null;
  transactionDiscount: number; // Transaction-level discount amount
  transactionDiscountType: 'percentage' | 'fixed' | null; // Type of transaction discount
  transactionDiscountValue: number; // Original discount value (percentage or fixed amount)
  
  // Scanner state
  isScannerOpen: boolean;
  scanType: 'barcode' | 'qr' | 'product' | 'invoice';
  
  // Modal states
  isPaymentModalOpen: boolean;
  isCreditModalOpen: boolean;
  isDayCloseModalOpen: boolean;
  isDayOpenModalOpen: boolean;
  
  // Actions
  addToCart: (product: Product, quantity?: number, storeId?: number | null) => void;
  setCurrentStoreId: (storeId: number | null) => void;
  filterCartByStore: (storeId: number | null, itemsToFilter?: ExtendedCartItem[]) => void;
  removeFromCart: (productId: number | null, sku?: string) => void;
  updateCartItemQuantity: (productId: number | null, sku: string, quantity: number) => void;
  updateCartItemDiscount: (productId: number | null, sku: string, discountValue: string, discountType: 'percentage' | 'fixed') => void;
  clearCart: () => void;
  resumeTransaction: (transactionData: any) => void;
  
  setCurrentCustomer: (customer: Customer | null) => void;
  setCurrentDay: (day: DayOperation | null) => void;
  setIsDayOpen: (isOpen: boolean) => void;
  setSelectedDate: (date: string) => void;
  setCurrentTransactionNumber: (number: string) => void;
  setResumedHeldTransactionId: (id: number | null) => void;
  setTransactionDiscount: (amount: number, type: 'percentage' | 'fixed', value: number) => void;
  clearTransactionDiscount: () => void;
  
  openScanner: (type: 'barcode' | 'qr' | 'product' | 'invoice') => void;
  closeScanner: () => void;
  
  openPaymentModal: () => void;
  closePaymentModal: () => void;
  
  openCreditModal: () => void;
  closeCreditModal: () => void;
  
  openDayCloseModal: () => void;
  closeDayCloseModal: () => void;
  
  openDayOpenModal: () => void;
  closeDayOpenModal: () => void;
  
  // Computed values
  getCartSubtotal: () => number;
  getCartVAT: () => number;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  getTransactionDiscount: () => number;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => {
      return {
      // Initial state
      cartItems: [],
      currentCustomer: null,
      currentStoreId: null,
      currentDay: null,
      isDayOpen: false,
      selectedDate: new Date().toISOString().split('T')[0], // Default to today
      currentTransactionNumber: '',
      resumedHeldTransactionId: null,
      transactionDiscount: 0,
      transactionDiscountType: null,
      transactionDiscountValue: 0,
      isScannerOpen: false,
      scanType: 'barcode',
      isPaymentModalOpen: false,
      isCreditModalOpen: false,
      isDayCloseModalOpen: false,
      isDayOpenModalOpen: false,
      
      // Actions
      addToCart: (product: Product, quantity = 1, storeId?: number | null) => {
        console.log('Adding to cart:', product, 'quantity:', quantity, 'storeId:', storeId);
        
        const state = get();
        const cartItems = state.cartItems;
        const isFirstItem = cartItems.length === 0;
        
        // Ensure we have a storeId - either passed in or from current state
        const effectiveStoreId = storeId ?? state.currentStoreId;
        console.log('[POS Store] Effective storeId for cart item:', effectiveStoreId);
        
        if (!effectiveStoreId) {
          console.warn('[POS Store] No store selected! Cannot add item to cart without a store.');
          window.dispatchEvent(new CustomEvent('noStoreSelected'));
          return;
        }
        
        // Generate unique bill number when first item is added if not already set
        if (isFirstItem && !state.currentTransactionNumber) {
          // Dispatch event to request transaction number generation
          // The POS page will handle this and set it in the store
          window.dispatchEvent(new CustomEvent('requestTransactionNumber'));
        }
        
        // Use the provided quantity parameter, defaulting to 1 if not provided
        const qty = Math.max(1, quantity || 1);
        
        // Check stock availability for non-custom items
        if (product.id !== null && product.id !== undefined) {
          const currentStock = product.stock ?? product.quantity ?? 0;
          const existingCartItem = cartItems.find(item => item.productId === product.id);
          const currentCartQuantity = existingCartItem ? existingCartItem.quantity : 0;
          const requestedQuantity = currentCartQuantity + qty;
          
          if (requestedQuantity > currentStock) {
            // Dispatch event to show out-of-stock warning
            window.dispatchEvent(new CustomEvent('outOfStock', {
              detail: {
                product: product.name,
                availableStock: currentStock,
                requestedQuantity: requestedQuantity,
                currentCartQuantity: currentCartQuantity
              }
            }));
            return; // Don't add to cart if out of stock
          }
        }
        
        // Ensure price is a valid number and convert to string
        const productPrice = product.price;
        const priceValue = typeof productPrice === 'number' 
          ? productPrice 
          : (typeof productPrice === 'string' ? parseFloat(productPrice) : 0);
        const priceString = isNaN(priceValue) || priceValue <= 0 ? '0.00' : priceValue.toString();
        
        // Ensure all required fields are present
        const productName = product.name || 'Unknown Product';
        const productSku = product.sku || `SKU-${product.id || 'CUSTOM'}`;
        
        // Get current stock for the product
        const currentStock = product.id !== null && product.id !== undefined
          ? (product.stock ?? product.quantity ?? 0)
          : undefined;
        
        // For custom items (null productId), match by SKU. For regular products, match by productId
        const existingItem = product.id !== null && product.id !== undefined
          ? cartItems.find(item => item.productId === product.id)
          : cartItems.find(item => item.sku === productSku && item.productId === null);
        
        if (existingItem) {
          console.log('Updating existing item:', existingItem);
          // Increment quantity by the provided quantity instead of replacing it
          const matchKey = product.id !== null && product.id !== undefined 
            ? (item: ExtendedCartItem) => item.productId === product.id
            : (item: ExtendedCartItem) => item.sku === productSku && item.productId === null;
          
          set({
            cartItems: cartItems.map(item => {
              if (!matchKey(item)) {
                return item;
              }
              
              const newQuantity = item.quantity + qty;
              const baseTotal = parseFloat(item.price || '0') * newQuantity;
              let newTotal = baseTotal;
              
              // Preserve discount if it exists
              if (item.discountAmount && item.discountType) {
                const discount = parseFloat(item.discountAmount);
                
                if (item.discountType === 'percentage') {
                  const discountAmount = baseTotal * (discount / 100);
                  newTotal = Math.max(0, baseTotal - discountAmount);
                } else {
                  // Fixed amount discount
                  newTotal = Math.max(0, baseTotal - discount);
                }
              }
              
              return {
                ...item,
                quantity: newQuantity,
                total: newTotal.toFixed(2),
                stock: currentStock, // Update stock info
                storeId: storeId ?? item.storeId ?? get().currentStoreId // Ensure storeId is preserved/updated
              };
            })
          });
        } else {
          const newItem: ExtendedCartItem = {
            productId: product.id ?? null, // Allow null for custom items
            sku: productSku,
            name: productName,
            price: priceString,
            quantity: qty,
            total: (qty * priceValue).toFixed(2),
            imageUrl: product.imageUrl || undefined,
            vatRate: parseFloat(product.vatRate?.toString() || '0'), // Use product's VAT rate or default to 0%
            stock: currentStock, // Store stock at time of adding
            storeId: effectiveStoreId, // Track which store this item belongs to
          };
          
          console.log('[POS Store] Adding new item with storeId:', effectiveStoreId, newItem);
          
          set({
            cartItems: [...cartItems, newItem]
          });
        }
        
        console.log('[POS Store] Cart updated. Total items:', get().cartItems.length, 'Items:', get().cartItems.map(i => `${i.name} (store: ${i.storeId})`));
        
        // Trigger VAT recalculation when items are added
        window.dispatchEvent(new CustomEvent('cartChanged'));
        
        // Dispatch event to clear search bar
        window.dispatchEvent(new CustomEvent('productAddedToCart'));
      },
      
      removeFromCart: (productId: number | null, sku?: string) => {
        const cartItems = get().cartItems;
        set({
          cartItems: cartItems.filter(item => {
            // Match by productId if both are non-null and equal, otherwise match by SKU
            if (productId !== null && item.productId !== null) {
              return item.productId !== productId;
            }
            return sku ? item.sku !== sku : item.productId !== productId;
          })
        });
      },
      
      updateCartItemQuantity: (productId: number | null, sku: string, quantity: number) => {
        // Ensure quantity is always at least 1
        const qty = Math.max(1, quantity || 1);
        
        // Optimized with batch update to prevent lag
        const cartItems = get().cartItems;
        const updatedItems = cartItems.map(item => {
          // Match by productId if both are non-null and equal, otherwise match by SKU
          const isMatch = productId !== null && item.productId !== null
            ? item.productId === productId
            : item.sku === sku;
          
          if (!isMatch) {
            return item;
          }
          
          // Check stock availability for non-custom items
          if (productId !== null && item.stock !== undefined) {
            if (qty > item.stock) {
              // Dispatch event to show out-of-stock warning
              window.dispatchEvent(new CustomEvent('outOfStock', {
                detail: {
                  product: item.name,
                  availableStock: item.stock,
                  requestedQuantity: qty
                }
              }));
              // Don't update quantity if it exceeds stock
              return item;
            }
          }
          
          const baseTotal = parseFloat(item.price) * qty;
          let newTotal = baseTotal;
          
          // Preserve discount if it exists
          if (item.discountAmount && item.discountType) {
            const discount = parseFloat(item.discountAmount);
            
            if (item.discountType === 'percentage') {
              const discountAmount = baseTotal * (discount / 100);
              newTotal = Math.max(0, baseTotal - discountAmount);
            } else {
              // Fixed amount discount
              newTotal = Math.max(0, baseTotal - discount);
            }
          }
          
          return {
            ...item,
            quantity: qty,
            total: newTotal.toFixed(2)
          };
        });
        
        set({ cartItems: updatedItems });
      },
      
      updateCartItemDiscount: (productId: number | null, sku: string, discountValue: string, discountType: 'percentage' | 'fixed') => {
        const cartItems = get().cartItems;
        const updatedItems = cartItems.map(item => {
          // Match by productId if both are non-null and equal, otherwise match by SKU
          const isMatch = productId !== null && item.productId !== null
            ? item.productId === productId
            : item.sku === sku;
          
          if (!isMatch) {
            return item;
          }
          
          const baseTotal = parseFloat(item.price) * item.quantity;
          let newTotal = baseTotal;
          
          // Apply discount if discountValue is provided
          if (discountValue && discountValue !== "" && !isNaN(parseFloat(discountValue))) {
            const discount = parseFloat(discountValue);
            
            if (discountType === 'percentage') {
              const discountAmount = baseTotal * (discount / 100);
              newTotal = Math.max(0, baseTotal - discountAmount);
            } else {
              // Fixed amount discount
              newTotal = Math.max(0, baseTotal - discount);
            }
            
            return {
              ...item,
              discountAmount: discountValue,
              discountType: discountType,
              total: newTotal.toFixed(2)
            };
          } else {
            // Remove discount if empty value
            return {
              ...item,
              discountAmount: undefined,
              discountType: undefined,
              total: baseTotal.toFixed(2)
            };
          }
        });
        
        set({ cartItems: updatedItems });
      },
      
      clearCart: () => {
        set({
          cartItems: [],
          currentCustomer: null,
          currentTransactionNumber: '', // Clear transaction number when cart is cleared
          resumedHeldTransactionId: null,
          transactionDiscount: 0,
          transactionDiscountType: null,
          transactionDiscountValue: 0
        });
      },
      
      resumeTransaction: (transactionData: any) => {
        try {
          const parsedData = typeof transactionData === 'string' ? JSON.parse(transactionData) : transactionData;
          
          set({
            cartItems: parsedData.items || [],
            currentCustomer: null, // We'll set this separately after fetching customer data
            currentTransactionNumber: parsedData.transactionNumber || ''
          });
          
          // If there's a customer ID, we should fetch the customer data separately
          // For now, we'll set it to null to avoid the error
        } catch (error) {
          console.error('Error resuming transaction:', error);
        }
      },
      
      setCurrentCustomer: (customer: Customer | null) => {
        set({ currentCustomer: customer });
      },
      
      setCurrentDay: (day: DayOperation | null) => {
        set({ 
          currentDay: day,
          isDayOpen: day?.status === 'open'
        });
      },

      setIsDayOpen: (isOpen: boolean) => {
        set({ isDayOpen: isOpen });
      },

      setSelectedDate: (date: string) => {
        // Enhanced date persistence with validation
        console.log('Setting selected date:', date);
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          console.warn('Invalid date format, using today:', date);
          date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        }
        set({ selectedDate: date });
      },
      
      setCurrentTransactionNumber: (number: string) => {
        set({ currentTransactionNumber: number });
      },

      setResumedHeldTransactionId: (id: number | null) => {
        set({ resumedHeldTransactionId: id });
      },
      
      setTransactionDiscount: (amount: number, type: 'percentage' | 'fixed', value: number) => {
        set({
          transactionDiscount: amount,
          transactionDiscountType: type,
          transactionDiscountValue: value
        });
      },
      
      clearTransactionDiscount: () => {
        set({
          transactionDiscount: 0,
          transactionDiscountType: null,
          transactionDiscountValue: 0
        });
      },
      
      openScanner: (type: 'barcode' | 'qr' | 'product' | 'invoice') => {
        set({ isScannerOpen: true, scanType: type });
      },
      
      closeScanner: () => {
        set({ isScannerOpen: false });
      },
      
      openPaymentModal: () => {
        set({ isPaymentModalOpen: true });
      },
      
      closePaymentModal: () => {
        set({ isPaymentModalOpen: false });
      },
      
      openCreditModal: () => {
        set({ isCreditModalOpen: true });
      },
      
      closeCreditModal: () => {
        set({ isCreditModalOpen: false });
      },
      
      openDayCloseModal: () => {
        set({ isDayCloseModalOpen: true });
      },
      
      closeDayCloseModal: () => {
        set({ isDayCloseModalOpen: false });
      },
      
      openDayOpenModal: () => {
        set({ isDayOpenModalOpen: true });
      },
      
      closeDayOpenModal: () => {
        set({ isDayOpenModalOpen: false });
      },
      
      // Computed values
      getCartSubtotal: () => {
        // Subtotal = Sum(Item Price × Quantity) for all items
        // This is the base amount before VAT and before discount
        return get().cartItems.reduce((sum, item) => {
          const price = parseFloat(item.price || '0');
          const quantity = item.quantity || 0;
          return sum + (price * quantity);
        }, 0);
      },
      
      getCartVAT: () => {
        const cartItems = get().cartItems;
        
        // VAT is calculated on the subtotal (price × quantity) BEFORE discount
        // VAT = Subtotal × VAT%
        return cartItems.reduce((totalVAT, item) => {
          const price = parseFloat(item.price || '0');
          const quantity = item.quantity || 0;
          const itemSubtotal = price * quantity; // Calculate from price and quantity, not item.total
          
          // Determine VAT rate based on stored VAT rate
          let vatRate = item.vatRate || 0; // Default to stored VAT rate or 0%
          
          return totalVAT + (itemSubtotal * vatRate) / 100;
        }, 0);
      },
      
      getCartTotal: () => {
        const subtotal = get().getCartSubtotal();
        const vat = get().getCartVAT();
        const discount = get().transactionDiscount || 0;
        // Total Amount = Grand Total (Subtotal + VAT) - Discount
        return subtotal + vat - discount;
      },
      
      getTransactionDiscount: () => {
        return get().transactionDiscount || 0;
      },
      
      setCurrentStoreId: (storeId: number | null) => {
        const currentStoreId = get().currentStoreId;
        const currentCartItems = get().cartItems;
        
        // If store is changing, filter cart items
        if (currentStoreId !== storeId) {
          console.log('[POS Store] Store changing from', currentStoreId, 'to', storeId);
          console.log('[POS Store] Current cart items before filter:', currentCartItems.length, currentCartItems.map(i => `${i.name} (storeId: ${i.storeId})`));
          
          // Update store ID first
          set({ currentStoreId: storeId });
          
          // Then filter cart items if we have items
          if (currentCartItems.length > 0) {
            // Call filter with the current items snapshot
            get().filterCartByStore(storeId, currentCartItems);
          }
        } else {
          console.log('[POS Store] Store unchanged, keeping current storeId:', storeId);
          set({ currentStoreId: storeId });
        }
      },
      
      filterCartByStore: (storeId: number | null, itemsToFilter?: ExtendedCartItem[]) => {
        const cartItems = itemsToFilter || get().cartItems;
        
        if (!storeId) {
          // If no store selected, clear all items
          console.log('[POS Store] No store selected, clearing cart');
          if (cartItems.length > 0) {
            set({ cartItems: [] });
          }
          return;
        }
        
        // Filter items - ONLY keep items that belong to the current store
        // Remove all items that don't have a storeId or have a different storeId
        const filteredItems = cartItems.filter(item => {
          const itemBelongsToCurrentStore = item.storeId === storeId;
          if (!itemBelongsToCurrentStore) {
            console.log(`[POS Store] Removing item "${item.name}" - belongs to store ${item.storeId}, current store is ${storeId}`);
          }
          return itemBelongsToCurrentStore;
        });
        
        const removedCount = cartItems.length - filteredItems.length;
        
        if (removedCount > 0) {
          console.log(`[POS Store] Filtered out ${removedCount} items not belonging to store ${storeId}`);
          set({ cartItems: filteredItems });
          
          // Notify user about filtered items
          window.dispatchEvent(new CustomEvent('cartFilteredByStore', {
            detail: { removedCount, storeId }
          }));
        } else {
          console.log('[POS Store] All cart items belong to current store');
        }
      },
      
      getCartItemCount: () => {
        return get().cartItems.reduce((sum, item) => sum + item.quantity, 0);
      }
    };
  },
    {
      name: 'pos-store',
      partialize: (state) => ({
        cartItems: state.cartItems,
        currentCustomer: state.currentCustomer,
        currentStoreId: state.currentStoreId,
        currentTransactionNumber: state.currentTransactionNumber,
        resumedHeldTransactionId: state.resumedHeldTransactionId,
        transactionDiscount: state.transactionDiscount,
        transactionDiscountType: state.transactionDiscountType,
        transactionDiscountValue: state.transactionDiscountValue
      })
    }
  )
);
