// HTML-based invoice generation (no PDF dependencies needed)
import fs from "fs";
import path from "path";
import type { GeneratedInvoice, GeneratedInvoiceItem, Customer, Store, Transaction, TransactionItem } from "@shared/schema";

interface InvoiceData {
  invoice: GeneratedInvoice;
  items: GeneratedInvoiceItem[];
  customer?: Customer;
  store: Store;
  transaction: Transaction;
}

interface TransactionItemWithProduct extends TransactionItem {
  productName: string;
}

export class PDFService {
  private readonly invoiceDir = "static/invoices";

  constructor() {
    // Ensure invoice directory exists
    if (!fs.existsSync("static")) {
      fs.mkdirSync("static", { recursive: true });
    }
    if (!fs.existsSync(this.invoiceDir)) {
      fs.mkdirSync(this.invoiceDir, { recursive: true });
    }
  }

  async generateInvoicePDF(invoiceData: InvoiceData): Promise<{ filePath: string; url: string }> {
    const { invoice, items, customer, store } = invoiceData;
    
    const htmlContent = this.generateInvoiceHTML(invoice, items, customer, store);
    
    const fileName = `invoice-${invoice.invoiceNumber}.html`;
    const filePath = path.join(this.invoiceDir, fileName);
    const url = `/static/invoices/${fileName}`;

    try {
      // For now, save as HTML instead of PDF due to Puppeteer dependencies
      // In production, this would be a proper PDF but HTML works for sharing
      fs.writeFileSync(filePath, htmlContent);
      
      return { filePath, url };
    } catch (error) {
      console.error("Error generating invoice file:", error);
      throw new Error(`Failed to generate invoice: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateInvoiceHTML(
    invoice: GeneratedInvoice, 
    items: GeneratedInvoiceItem[], 
    customer?: Customer, 
    store?: Store
  ): string {
    const date = new Date(invoice.createdAt || new Date()).toLocaleDateString();
    const time = new Date(invoice.createdAt || new Date()).toLocaleTimeString();

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoiceNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          background: white;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 20px;
        }
        
        .company-info {
          flex: 1;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }
        
        .company-details {
          color: #6b7280;
          font-size: 11px;
        }
        
        .invoice-info {
          text-align: right;
          flex: 1;
        }
        
        .invoice-title {
          font-size: 28px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 8px;
        }
        
        .invoice-number {
          font-size: 14px;
          color: #374151;
          margin-bottom: 4px;
        }
        
        .invoice-date {
          font-size: 11px;
          color: #6b7280;
        }
        
        .bill-to-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        
        .bill-to, .payment-info {
          flex: 1;
        }
        
        .section-title {
          font-weight: bold;
          color: #374151;
          margin-bottom: 8px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .customer-info {
          background: #f8fafc;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #2563eb;
        }
        
        .customer-name {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 4px;
        }
        
        .customer-details {
          font-size: 11px;
          color: #6b7280;
        }
        
        .payment-details {
          background: #f0fdf4;
          padding: 15px;
          border-radius: 6px;
          border-left: 4px solid #10b981;
        }
        
        .payment-method {
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 4px;
          color: #065f46;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .items-table th {
          background: #2563eb;
          color: white;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .items-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .items-table tr:last-child td {
          border-bottom: none;
        }
        
        .items-table tr:nth-child(even) {
          background: #f9fafb;
        }
        
        .text-right {
          text-align: right;
        }
        
        .text-center {
          text-align: center;
        }
        
        .totals-section {
          margin-left: auto;
          width: 300px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e5e7eb;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 13px;
        }
        
        .total-row.final {
          border-top: 2px solid #2563eb;
          padding-top: 12px;
          margin-top: 12px;
          font-weight: bold;
          font-size: 16px;
          color: #1f2937;
        }
        
        .footer {
          margin-top: 40px;
          text-align: center;
          color: #6b7280;
          font-size: 10px;
          border-top: 1px solid #e5e7eb;
          padding-top: 20px;
        }
        
        .qr {
          font-weight: bold;
          color: #059669;
        }
        
        @media print {
          body { print-color-adjust: exact; }
          .invoice-container { margin: 0; padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="company-info">
            <div class="company-name">${store?.name || 'Store Name'}</div>
            <div class="company-details">
              ${store?.address || 'Store Address'}<br>
              Phone: ${store?.phone || 'Phone Number'}<br>
              Email: ${store?.email || 'Email Address'}
            </div>
          </div>
          <div class="invoice-info">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">#${invoice.invoiceNumber}</div>
            <div class="invoice-date">Date: ${date}<br>Time: ${time}</div>
          </div>
        </div>

        <!-- Bill To Section -->
        <div class="bill-to-section">
          <div class="bill-to">
            <div class="section-title">Bill To</div>
            <div class="customer-info">
              <div class="customer-name">${customer?.name || 'Walk-in Customer'}</div>
              <div class="customer-details">
                ${customer?.email ? `Email: ${customer.email}<br>` : ''}
                ${customer?.phone ? `Phone: ${customer.phone}<br>` : ''}
                ${customer?.address ? `Address: ${customer.address}` : ''}
              </div>
            </div>
          </div>
          
          <div class="payment-info">
            <div class="section-title">Payment Information</div>
            <div class="payment-details">
              <div class="payment-method">${invoice.paymentMethod.toUpperCase()}</div>
              <div class="customer-details">
                ${invoice.cashTendered ? `Cash Tendered: QR ${Number(invoice.cashTendered).toFixed(2)}<br>` : ''}
                ${invoice.cardType ? `Card Type: ${invoice.cardType}<br>` : ''}
                ${invoice.cashTendered && Number(invoice.cashTendered) > Number(invoice.total) ? 
                  `Change: QR ${(Number(invoice.cashTendered) - Number(invoice.total)).toFixed(2)}` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 10%;">Item</th>
              <th style="width: 35%;">Description</th>
              <th style="width: 15%;">SKU</th>
              <th style="width: 10%;" class="text-center">Qty</th>
              <th style="width: 15%;" class="text-right">Unit Price</th>
              <th style="width: 15%;" class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${item.productName}</td>
                <td><small>${item.sku || 'N/A'}</small></td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right qr">QR ${Number(item.unitPrice).toFixed(2)}</td>
                <td class="text-right qr">QR ${Number(item.total).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-section">
          <div class="total-row">
            <span>Subtotal:</span>
            <span class="qr">QR ${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>VAT (5%):</span>
            <span class="qr">QR ${Number(invoice.tax).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>Grand Total:</span>
            <span class="qr">QR ${(Number(invoice.subtotal) + Number(invoice.tax)).toFixed(2)}</span>
          </div>
          ${Number(invoice.discount) > 0 ? `
          <div class="total-row discount">
            <span>Discount:</span>
            <span class="qr">-QR ${Number(invoice.discount).toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row final">
            <span>Total Amount:</span>
            <span class="qr">QR ${Number(invoice.total).toFixed(2)}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>This is a computer-generated invoice and does not require a signature.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  generateWhatsAppLink(invoice: GeneratedInvoice, pdfUrl: string, baseUrl?: string): string {
    // Use the correct Replit domain from environment variables
    const defaultBaseUrl = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS || `${process.env.REPL_SLUG || 'pos-system'}.replit.app`;
    const actualBaseUrl = baseUrl || defaultBaseUrl;
    const fullUrl = `https://${actualBaseUrl}${pdfUrl}`;
    const message = `🧾 *Invoice ${invoice.invoiceNumber}*\n💰 *Total: QR ${Number(invoice.total).toFixed(2)}*\n📄 View Invoice: ${fullUrl}\n\nThank you for your business! 🙏`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  async generateReceiptPDF(transaction: Transaction, items: TransactionItemWithProduct[], store: Store, customer?: Customer): Promise<{ filePath: string; url: string }> {
    const htmlContent = this.generateReceiptHTML(transaction, items, store, customer);
    
    const fileName = `receipt-${transaction.transactionNumber || transaction.id}.html`;
    const filePath = path.join(this.invoiceDir, fileName);
    const url = `/static/invoices/${fileName}`;

    try {
      fs.writeFileSync(filePath, htmlContent);
      return { filePath, url };
    } catch (error) {
      console.error("Error generating receipt file:", error);
      throw new Error(`Failed to generate receipt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private generateReceiptHTML(transaction: Transaction, items: TransactionItemWithProduct[], store: Store, customer?: Customer): string {
    const transactionDate = new Date(transaction.createdAt || new Date()).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const itemsHTML = items.map(item => `
      <tr>
        <td class="py-2 border-b">${item.productName}</td>
        <td class="py-2 border-b text-center">${item.quantity}</td>
        <td class="py-2 border-b text-right">QR ${Number(item.unitPrice).toFixed(2)}</td>
        <td class="py-2 border-b text-right font-semibold">QR ${Number(item.total).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Receipt #${transaction.id}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 600px; 
          margin: 0 auto; 
          padding: 20px; 
          line-height: 1.6;
          background: white;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #333; 
          padding-bottom: 20px; 
          margin-bottom: 20px; 
        }
        .store-name { 
          font-size: 24px; 
          font-weight: bold; 
          color: #333; 
          margin-bottom: 8px;
        }
        .receipt-title { 
          font-size: 18px; 
          color: #666; 
          margin: 10px 0;
        }
        .info-section { 
          margin: 20px 0; 
          padding: 15px; 
          background-color: #f8f9fa; 
          border-radius: 5px;
        }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 8px 0; 
        }
        .label { 
          font-weight: bold; 
          color: #555; 
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 20px 0; 
        }
        th { 
          background-color: #f1f3f4; 
          padding: 12px 8px; 
          text-align: left; 
          font-weight: bold; 
          border-bottom: 2px solid #ddd;
        }
        td { 
          padding: 8px; 
          border-bottom: 1px solid #eee; 
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .total-section { 
          margin-top: 20px; 
          padding: 15px; 
          background-color: #e8f4fd; 
          border-radius: 5px;
          border-left: 4px solid #2196f3;
        }
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 5px 0; 
          font-size: 16px;
        }
        .total-final { 
          font-weight: bold; 
          font-size: 18px; 
          color: #1976d2; 
          border-top: 2px solid #2196f3; 
          padding-top: 10px; 
          margin-top: 10px;
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          padding-top: 20px; 
          border-top: 1px solid #ddd; 
          color: #666; 
        }
        @media print {
          body { margin: 0; padding: 15px; }
          .total-section { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="store-name">${store.name}</div>
        <div style="color: #666; margin: 5px 0;">${store.address || ''}</div>
        <div style="color: #666; margin: 5px 0;">${store.phone || ''}</div>
        <div class="receipt-title">SALES RECEIPT</div>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="label">Receipt #:</span>
          <span>${transaction.transactionNumber || transaction.id}</span>
        </div>
        <div class="info-row">
          <span class="label">Date:</span>
          <span>${transactionDate}</span>
        </div>
        ${customer ? `
        <div class="info-row">
          <span class="label">Customer:</span>
          <span>${customer.name}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="label">Payment Method:</span>
          <span style="text-transform: capitalize;">${transaction.paymentMethod}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="text-center">Qty</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>QR ${Number(transaction.subtotal || 0).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>VAT (5%):</span>
          <span>QR ${Number(transaction.vatAmount || transaction.tax || 0).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Grand Total:</span>
          <span>QR ${(Number(transaction.subtotal || 0) + Number(transaction.vatAmount || transaction.tax || 0)).toFixed(2)}</span>
        </div>
        ${Number(transaction.discountAmount || 0) > 0 ? `
        <div class="total-row">
          <span>Discount:</span>
          <span>-QR ${Number(transaction.discountAmount).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row total-final">
          <span>Total Amount:</span>
          <span>QR ${Number(transaction.total).toFixed(2)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Thank you for your business!</p>
        <p style="font-size: 12px; color: #999;">This is a computer-generated receipt.</p>
      </div>
    </body>
    </html>
    `;
  }

  async deletePDF(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Error deleting PDF:", error);
    }
  }
}

export const pdfService = new PDFService();