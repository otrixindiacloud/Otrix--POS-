// Sample data generators for demonstration purposes
export const generateSampleHeldTransactions = () => [
  {
    id: 1001,
    transactionData: JSON.stringify({
      transactionNumber: "HOLD-2025-001",
      customerId: 16,
      items: [
        { id: 1, name: "Coffee - Premium Blend", quantity: 2, unitPrice: 12.99, total: 25.98 },
        { id: 2, name: "Croissant", quantity: 3, unitPrice: 3.50, total: 10.50 }
      ],
      subtotal: 36.48,
      tax: 3.65,
      total: 40.13
    }),
    customerId: 16,
    cashierId: 1,
    holdReason: "Customer needs to get cash from ATM",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() // 45 minutes ago
  },
  {
    id: 1002,
    transactionData: JSON.stringify({
      transactionNumber: "HOLD-2025-002",
      customerId: null,
      items: [
        { id: 3, name: "Sandwich - Turkey Club", quantity: 1, unitPrice: 8.99, total: 8.99 },
        { id: 4, name: "Chips", quantity: 1, unitPrice: 2.50, total: 2.50 },
        { id: 5, name: "Soda - Cola", quantity: 1, unitPrice: 1.99, total: 1.99 }
      ],
      subtotal: 13.48,
      tax: 1.35,
      total: 14.83
    }),
    customerId: null,
    cashierId: 1,
    holdReason: "Waiting for manager approval on discount",
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() // 20 minutes ago
  },
  {
    id: 1003,
    transactionData: JSON.stringify({
      transactionNumber: "HOLD-2025-003",
      customerId: 18,
      items: [
        { id: 6, name: "Laptop Charger", quantity: 1, unitPrice: 79.99, total: 79.99 },
        { id: 7, name: "USB Cable", quantity: 2, unitPrice: 12.99, total: 25.98 }
      ],
      subtotal: 105.97,
      tax: 10.60,
      total: 116.57
    }),
    customerId: 18,
    cashierId: 1,
    holdReason: "Customer comparing prices online",
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString() // 10 minutes ago
  }
];

export const generateSampleRiskAssessments = () => [
  {
    transactionId: 289,
    riskLevel: 'medium',
    riskScore: 0.65,
    badge: 'MODERATE RISK',
    color: '#f59e0b',
    flags: [
      'High-value transaction for new customer',
      'Cash payment over $500',
      'Multiple high-ticket items'
    ],
    recommendations: [
      'Verify customer identification',
      'Consider payment method alternatives',
      'Review transaction with supervisor'
    ],
    customerRiskProfile: {
      previousTransactions: 2,
      averageTransactionValue: 245.50,
      paymentMethods: ['cash', 'card'],
      lastTransactionDate: '2025-07-20'
    }
  },
  {
    transactionId: 288,
    riskLevel: 'low',
    riskScore: 0.25,
    badge: 'LOW RISK',
    color: '#10b981',
    flags: [],
    recommendations: [
      'Transaction appears normal',
      'Customer has good payment history'
    ],
    customerRiskProfile: {
      previousTransactions: 15,
      averageTransactionValue: 45.30,
      paymentMethods: ['card'],
      lastTransactionDate: '2025-07-22'
    }
  },
  {
    transactionId: 287,
    riskLevel: 'high',
    riskScore: 0.85,
    badge: 'HIGH RISK',
    color: '#ef4444',
    flags: [
      'Unusually large transaction amount',
      'First-time customer',
      'Cash payment requested',
      'Transaction pattern differs from typical'
    ],
    recommendations: [
      'Require manager approval',
      'Verify customer identity thoroughly',
      'Consider alternative payment methods',
      'Document transaction carefully'
    ],
    customerRiskProfile: {
      previousTransactions: 0,
      averageTransactionValue: 0,
      paymentMethods: [],
      lastTransactionDate: null
    }
  }
];

export const generateDailyRiskSummary = () => ({
  date: new Date().toISOString().split('T')[0],
  totalTransactions: 45,
  riskDistribution: {
    low: 32,
    medium: 11,
    high: 2
  },
  flaggedTransactions: [
    {
      id: 289,
      transactionNumber: '20250723002854',
      amount: 567.89,
      riskLevel: 'high',
      flags: ['Large cash transaction', 'New customer']
    },
    {
      id: 285,
      transactionNumber: '20250723001245',
      amount: 234.56,
      riskLevel: 'medium',
      flags: ['Unusual purchase pattern']
    }
  ],
  recommendations: [
    'Review all high-risk transactions with management',
    'Implement additional verification for cash transactions over $500',
    'Monitor new customer transaction patterns'
  ]
});