// Offline storage utilities for PWA functionality

interface OfflineTransaction {
  id: string;
  timestamp: number;
  type: 'sale' | 'return' | 'hold';
  data: any;
  synced: boolean;
}

class OfflineStorage {
  private dbName = 'pos-offline-db';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create transactions store
        if (!db.objectStoreNames.contains('transactions')) {
          const transactionStore = db.createObjectStore('transactions', { keyPath: 'id' });
          transactionStore.createIndex('timestamp', 'timestamp');
          transactionStore.createIndex('synced', 'synced');
        }
        
        // Create other stores as needed
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
    });
  }

  async storeTransaction(transaction: Omit<OfflineTransaction, 'id' | 'timestamp' | 'synced'>): Promise<string> {
    if (!this.db) await this.init();
    
    const id = `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const offlineTransaction: OfflineTransaction = {
      id,
      timestamp: Date.now(),
      synced: false,
      ...transaction
    };
    
    return new Promise((resolve, reject) => {
      const transaction_db = this.db!.transaction(['transactions'], 'readwrite');
      const store = transaction_db.objectStore('transactions');
      const request = store.add(offlineTransaction);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(id);
    });
  }

  async getUnsyncedTransactions(): Promise<OfflineTransaction[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readonly');
      const store = transaction.objectStore('transactions');
      const index = store.index('synced');
      const request = index.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async markTransactionSynced(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions'], 'readwrite');
      const store = transaction.objectStore('transactions');
      const getRequest = store.get(id);
      
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = true;
          const putRequest = store.put(data);
          putRequest.onerror = () => reject(putRequest.error);
          putRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
    });
  }

  async cacheData(key: string, data: any): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put({ key, data, timestamp: Date.now() });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getCachedData(key: string): Promise<any> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result?.data);
    });
  }

  async clearOldData(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init();
    
    const cutoffTime = Date.now() - maxAge;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['transactions', 'cache'], 'readwrite');
      
      // Clear old transactions
      const transactionStore = transaction.objectStore('transactions');
      const transactionIndex = transactionStore.index('timestamp');
      const transactionRequest = transactionIndex.openCursor(IDBKeyRange.upperBound(cutoffTime));
      
      transactionRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && cursor.value.synced) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      // Clear old cache
      const cacheStore = transaction.objectStore('cache');
      const cacheRequest = cacheStore.openCursor();
      
      cacheRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && cursor.value.timestamp < cutoffTime) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  }
}

export const offlineStorage = new OfflineStorage();

// Initialize offline storage when module is imported
offlineStorage.init().catch(console.error);

// Background sync handler
export async function syncOfflineData() {
  try {
    const unsyncedTransactions = await offlineStorage.getUnsyncedTransactions();
    
    for (const transaction of unsyncedTransactions) {
      try {
        // Attempt to sync with server
        const response = await fetch('/api/transactions/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transaction.data)
        });
        
        if (response.ok) {
          await offlineStorage.markTransactionSynced(transaction.id);
        }
      } catch (error) {
        console.error('Failed to sync transaction:', transaction.id, error);
      }
    }
    
    // Clean up old data
    await offlineStorage.clearOldData();
  } catch (error) {
    console.error('Error during background sync:', error);
  }
}

// Set up periodic background sync
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    if ('sync' in registration) {
      // Register for background sync
      return (registration as any).sync.register('background-sync');
    }
  });
}

// Sync when coming back online
window.addEventListener('online', () => {
  syncOfflineData();
});