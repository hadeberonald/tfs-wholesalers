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
    this.config = {
      secretKey: process.env.PAYSTACK_SECRET_KEY || '',
      publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    };
  }

  // Initialize payment
  async initializePayment(data: {
    email: string;
    amount: number; // in cents (e.g., R100 = 10000)
    reference: string;
    callback_url?: string;
  }) {
    try {
      const response = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Paystack initialization error:', error);
      throw error;
    }
  }

  // Verify payment
  async verifyPayment(reference: string) {
    try {
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
      return result;
    } catch (error) {
      console.error('Paystack verification error:', error);
      throw error;
    }
  }

  // Get public key for frontend
  getPublicKey() {
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
