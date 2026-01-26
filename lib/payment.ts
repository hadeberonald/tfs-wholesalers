// Payment Integration Utilities for Paystack and Ozow

interface PaystackConfig {
  secretKey: string;
  publicKey: string;
}

interface OzowConfig {
  apiKey: string;
  siteCode: string;
  privateKey: string;
}

// Paystack Integration
export class PaystackService {
  private config: PaystackConfig;

  constructor() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || '';

    this.config = {
      secretKey,
      publicKey,
    };

    // Debug logging
    console.log('🔑 Paystack Config Initialized:');
    console.log('Secret Key exists:', !!secretKey);
    console.log('Secret Key length:', secretKey.length);
    console.log('Secret Key prefix:', secretKey.substring(0, 8));
    console.log('Public Key exists:', !!publicKey);
    console.log('Public Key length:', publicKey.length);
    console.log('Public Key prefix:', publicKey.substring(0, 8));

    // Validate keys
    if (!secretKey || !secretKey.startsWith('sk_')) {
      console.error('❌ Invalid or missing PAYSTACK_SECRET_KEY');
      throw new Error('Invalid Paystack secret key configuration');
    }

    if (!publicKey || !publicKey.startsWith('pk_')) {
      console.error('❌ Invalid or missing PAYSTACK_PUBLIC_KEY');
      throw new Error('Invalid Paystack public key configuration');
    }

    console.log('✅ Paystack keys validated successfully');
  }

  // Initialize payment
  async initializePayment(data: {
    email: string;
    amount: number; // in cents (e.g., R100 = 10000)
    reference: string;
    callback_url?: string;
    metadata?: any;
    currency?: string;
  }) {
    try {
      console.log('💳 Initializing payment with Paystack API...');
      console.log('Using secret key prefix:', this.config.secretKey.substring(0, 8));
      
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ Paystack API error:', result);
        throw new Error(result.message || 'Payment initialization failed');
      }

      console.log('✅ Payment initialized successfully');
      return result;
    } catch (error) {
      console.error('❌ Paystack initialization error:', error);
      throw error;
    }
  }

  // Verify payment
  async verifyPayment(reference: string) {
    try {
      console.log('🔍 Verifying payment:', reference);
      
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.config.secretKey}`,
          },
        }
      );

      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ Paystack verification error:', result);
      } else {
        console.log('✅ Payment verified');
      }

      return result;
    } catch (error) {
      console.error('❌ Paystack verification error:', error);
      throw error;
    }
  }

  // Get public key for frontend
  getPublicKey() {
    if (!this.config.publicKey) {
      console.error('❌ Public key not available');
      throw new Error('Paystack public key not configured');
    }
    return this.config.publicKey;
  }
}

// Ozow Integration
export class OzowService {
  private config: OzowConfig;

  constructor() {
    this.config = {
      apiKey: process.env.OZOW_API_KEY || '',
      siteCode: process.env.OZOW_SITE_CODE || '',
      privateKey: process.env.OZOW_PRIVATE_KEY || '',
    };
  }

  // Generate payment request
  async generatePaymentRequest(data: {
    amount: number;
    transactionReference: string;
    bankReference: string;
    customer: string;
    isTest?: boolean;
  }) {
    const crypto = require('crypto');

    // Prepare data for hash
    const hashString = [
      this.config.siteCode,
      data.transactionReference,
      data.amount.toFixed(2),
      data.customer,
      this.config.privateKey,
    ].join('');

    // Generate hash
    const hashCheck = crypto
      .createHash('sha512')
      .update(hashString.toLowerCase())
      .digest('hex');

    const paymentRequest = {
      SiteCode: this.config.siteCode,
      CountryCode: 'ZA',
      CurrencyCode: 'ZAR',
      Amount: data.amount.toFixed(2),
      TransactionReference: data.transactionReference,
      BankReference: data.bankReference,
      Customer: data.customer,
      CancelUrl: `${process.env.NEXTAUTH_URL}/payment/cancel`,
      ErrorUrl: `${process.env.NEXTAUTH_URL}/payment/error`,
      SuccessUrl: `${process.env.NEXTAUTH_URL}/payment/success`,
      NotifyUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/ozow`,
      IsTest: data.isTest || false,
      HashCheck: hashCheck,
    };

    return paymentRequest;
  }

  // Verify payment notification
  verifyNotification(data: any) {
    const crypto = require('crypto');

    const hashString = [
      data.SiteCode,
      data.TransactionId,
      data.TransactionReference,
      data.Amount,
      data.Status,
      this.config.privateKey,
    ].join('');

    const calculatedHash = crypto
      .createHash('sha512')
      .update(hashString.toLowerCase())
      .digest('hex');

    return calculatedHash === data.Hash;
  }

  // Get payment URL
  getPaymentUrl() {
    return 'https://pay.ozow.com';
  }
}

// Helper function to format amount for payments
export function formatAmountForPayment(amount: number): number {
  // Paystack expects amount in cents
  return Math.round(amount * 100);
}

// Helper function to generate unique reference
export function generatePaymentReference(prefix: string = 'PAY'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Export singleton instances
export const paystackService = new PaystackService();
export const ozowService = new OzowService();