# TFS Wholesalers E-Commerce Platform

A comprehensive wholesale e-commerce platform built with Next.js 14, TypeScript, Tailwind CSS, and MongoDB.

## 🚀 Features

### Customer-Facing Features
- **Product Browsing**: Search and filter products by category
- **Shopping Cart**: Add, update, and remove items
- **Checkout**: Complete order process with delivery address
- **Payment Integration**: Paystack, Ozow, and Cash on Delivery
- **Order Tracking**: View order history and status
- **Special Offers**: Featured products with discounts
- **Responsive Design**: Mobile-first, professional UI
- **Location-Based Delivery**: Automatic delivery fee calculation

### Admin Portal
- **Dashboard**: Overview of sales, orders, and customers
- **Product Management**: Full CRUD operations for products
- **Stock Management**: Update inventory levels
- **Order Management**: View and update order statuses
- **User Management**: Add customers and pickers
- **Hero Banner Management**: Update homepage banners
- **Delivery Pricing**: Edit delivery fee tiers
- **Category Management**: Organize products

### Delivery System
- **Local**: R35 (20km radius)
- **Medium**: R85 (40km radius)
- **Far**: R105 (60km radius)
- Editable pricing in admin settings

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- MongoDB 4.4+ (local or Atlas)
- Paystack account (for card payments)
- Ozow account (for instant EFT)

## 🛠️ Installation

### 1. Clone and Install
```bash
cd tfs-wholesalers
npm install
```

### 2. Environment Setup
Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Update the following variables:
- `MONGODB_URI`: Your MongoDB connection string
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
- `PAYSTACK_SECRET_KEY` & `PAYSTACK_PUBLIC_KEY`: From Paystack dashboard
- `OZOW_API_KEY`, `OZOW_SITE_CODE`, `OZOW_PRIVATE_KEY`: From Ozow dashboard
- Email settings for order notifications

### 3. Database Setup

#### Option A: Local MongoDB
```bash
# Install MongoDB locally
# Then start MongoDB service
mongod

# The app will automatically create collections
```

#### Option B: MongoDB Atlas
1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string
3. Add to `.env` as `MONGODB_URI`

### 4. Seed Initial Data (Optional)
```bash
# Create a seed script or manually add data through admin portal
npm run dev
# Navigate to http://localhost:3000/admin
```

## 🚀 Running the Application

### Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Production
```bash
npm run build
npm start
```

## 📱 React Native App (Mobile Picker App)

The picker/delivery mobile app will be created separately using:
- Expo with EAS CLI
- React Native
- Same API endpoints

**Note**: The mobile app is mentioned for future development and is not included in this web platform package.

## 🗂️ Project Structure

```
tfs-wholesalers/
├── app/                    # Next.js 14 App Router
│   ├── admin/             # Admin portal pages
│   ├── api/               # API routes
│   ├── cart/              # Shopping cart page
│   ├── checkout/          # Checkout process
│   ├── products/          # Product listing/detail
│   ├── account/           # Customer account pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── home/             # Homepage sections
│   ├── admin/            # Admin components
│   ├── Header.tsx        # Main header
│   ├── Footer.tsx        # Main footer
│   └── ProductCard.tsx   # Product card component
├── lib/                   # Utilities and helpers
│   ├── mongodb.ts        # Database connection
│   ├── utils.ts          # Helper functions
│   └── store.ts          # Zustand cart store
├── types/                 # TypeScript types
│   └── index.ts          # All type definitions
├── public/               # Static assets
│   └── logo.png          # (Add your logo here)
└── ...config files
```

## 🎨 Design System

### Colors
- **Primary Orange**: #FF6B35
- **Black**: #1A1A1A
- **White**: #FFFFFF

### Typography
- **Display**: DM Serif Display (Google Fonts)
- **Body**: Manrope (Google Fonts)

### Components
- Rounded corners (0.75rem - 2rem)
- Card hover effects
- Smooth transitions
- Professional, clean aesthetic

## 🔐 Authentication

The platform uses NextAuth.js for authentication:
- Email/password for all user types
- Role-based access control (customer, admin, picker)
- JWT tokens for API authentication

## 💳 Payment Integration

### Paystack
- Card payments (Visa, Mastercard)
- Webhooks for payment confirmation
- Test mode for development

### Ozow
- Instant EFT payments
- Direct bank integration
- Test mode for development

### Cash on Delivery
- Pay when order is received
- Manual confirmation by admin

## 📧 Email Notifications

Uses Nodemailer for:
- Order confirmation
- Order status updates
- Delivery notifications
- Password reset (if implemented)

## 🚚 Delivery Fee Calculation

Based on distance from store location:
```javascript
// lib/utils.ts
calculateDeliveryFee(distance, pricing)
```

Uses Haversine formula for distance calculation.

## 🔧 Admin Features

### Product Management
- Add/Edit/Delete products
- Upload multiple images
- Set special prices
- Manage stock levels
- SKU tracking

### Hero Banner Management
**Image Requirements**:
- Recommended size: 1920 x 800 pixels
- Format: JPG, PNG
- Max file size: 2MB
- Aspect ratio: 12:5

### Order Management
- View all orders
- Update order status
- Assign pickers
- Mark as delivered
- Track payment status

### User Management
- Add admin users
- Add picker users
- Manage customer accounts
- Role-based permissions

## 📊 API Endpoints

### Products
- `GET /api/products` - List all products
- `GET /api/products?category=groceries` - Filter by category
- `GET /api/products?onSpecial=true` - Get specials
- `POST /api/products` - Create product (admin)
- `PUT /api/products/[id]` - Update product (admin)
- `DELETE /api/products/[id]` - Delete product (admin)

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/[id]` - Get order details
- `PUT /api/orders/[id]` - Update order status (admin)

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (admin)

## 🌐 Deployment

### Recommended: Render.com
1. Create account at [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Set environment variables
5. Deploy!

### Alternative: Vercel
```bash
npm install -g vercel
vercel
```

## 🔮 Future Enhancements

- [ ] React Native picker app
- [ ] Advanced analytics dashboard
- [ ] Inventory alerts
- [ ] Customer loyalty program
- [ ] Review and rating system
- [ ] Multi-language support
- [ ] Advanced search filters
- [ ] Wishlist functionality
- [ ] Bulk order discounts
- [ ] Invoice generation

## 🐛 Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network access (for Atlas)

### Payment Integration
- Use test keys for development
- Check webhook URLs are configured
- Verify API credentials

### Image Upload Issues
- Check file size limits
- Ensure correct MIME types
- Verify upload directory permissions

## 📄 License

Proprietary - TFS Wholesalers

## 🤝 Support

For support, email: info@tfswholesalers.co.za

## 🎯 Quick Start Checklist

- [ ] Install Node.js and MongoDB
- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Copy `.env.example` to `.env`
- [ ] Update environment variables
- [ ] Add your logo to `public/logo.png`
- [ ] Run `npm run dev`
- [ ] Access admin at `/admin`
- [ ] Add your first products
- [ ] Upload hero banners
- [ ] Set delivery pricing
- [ ] Test checkout flow
- [ ] Deploy to production

---

Built with ❤️ for TFS Wholesalers
