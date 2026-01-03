# Quick Setup Guide - TFS Wholesalers

## 🚀 Get Started in 5 Minutes

### Step 1: Extract Files
```bash
tar -xzf tfs-wholesalers.tar.gz
cd tfs-wholesalers
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
```

Edit `.env` with your settings:
- MongoDB URI
- Generate NEXTAUTH_SECRET: `openssl rand -base64 32`
- Add payment keys (use test keys for development)

### Step 4: Add Your Logo
Replace `public/logo.png` with your actual logo

### Step 5: Run Development Server
```bash
npm run dev
```

Visit: http://localhost:3000

### Step 6: Access Admin Portal
Navigate to: http://localhost:3000/admin

Create your first admin user and start adding products!

## 📋 What's Included

✅ Complete e-commerce platform
✅ Shopping cart with Zustand
✅ Product catalog with categories
✅ Checkout with delivery calculation
✅ Payment integration (Paystack, Ozow, Cash)
✅ Admin dashboard
✅ Order management
✅ Stock management
✅ Hero banner system
✅ Special offers section
✅ Responsive design
✅ Professional UI with Tailwind CSS

## 🎯 Next Steps

1. **Add Products**: Go to Admin → Products → Add Product
2. **Upload Hero Banners**: Admin → Hero Banners (1920x800px recommended)
3. **Set Delivery Pricing**: Admin → Settings
4. **Configure Categories**: Admin → Categories
5. **Test Order Flow**: Browse → Add to Cart → Checkout

## 📱 Mobile App (Coming Soon)

The React Native picker/delivery app will be developed separately using:
- Expo with EAS CLI
- Same API endpoints
- Real-time order updates

## 🆘 Need Help?

- Check README.md for full documentation
- See DEPLOYMENT.md for production setup
- Review code comments for implementation details

## 🔐 Default Credentials

After first setup, you'll need to create admin users through the database or add a seed script.

## 📞 Support

Email: info@tfswholesalers.co.za

---

Happy Selling! 🎉
