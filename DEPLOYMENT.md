# Deployment Guide for TFS Wholesalers

## 📦 Prerequisites

Before deploying, ensure you have:
- MongoDB database (Atlas recommended for production)
- Paystack account with API keys
- Ozow account with API keys
- Email service credentials (Gmail, SendGrid, etc.)
- Node.js 18+ installed locally for testing

## 🚀 Deploying to Render.com (Recommended)

### Step 1: Prepare Your Repository

1. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/hadeberonald/tfs-wholesalers.git
git push -u origin main
```

### Step 2: Set Up MongoDB Atlas

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Whitelist all IPs (0.0.0.0/0) for Render
5. Get your connection string

### Step 3: Create Render Web Service

1. Sign up at [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: tfs-wholesalers
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or paid for production)

### Step 4: Add Environment Variables

In Render dashboard, add these environment variables:

```
NODE_ENV=production
MONGODB_URI=your_mongodb_atlas_connection_string
NEXTAUTH_URL=https://your-app-name.onrender.com
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
PAYSTACK_SECRET_KEY=sk_live_your_key
PAYSTACK_PUBLIC_KEY=pk_live_your_key
OZOW_API_KEY=your_ozow_key
OZOW_SITE_CODE=your_site_code
OZOW_PRIVATE_KEY=your_private_key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=TFS Wholesalers <noreply@tfswholesalers.com>
STORE_LAT=-29.8587
STORE_LNG=31.0218
```

### Step 5: Deploy

1. Click "Create Web Service"
2. Wait for deployment (5-10 minutes)
3. Your site will be live at `https://your-app-name.onrender.com`

## 🌊 Deploying to Vercel (Alternative)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Deploy

```bash
cd tfs-wholesalers
vercel
```

Follow the prompts and add environment variables via Vercel dashboard.

## 🐳 Deploying with Docker (Advanced)

### Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Build and Run

```bash
docker build -t tfs-wholesalers .
docker run -p 3000:3000 --env-file .env tfs-wholesalers
```

## 🔐 Security Checklist

- [ ] Use strong NEXTAUTH_SECRET (32+ characters)
- [ ] Use production API keys (not test keys)
- [ ] Enable HTTPS (automatic on Render/Vercel)
- [ ] Set up MongoDB IP whitelist
- [ ] Configure CORS if needed
- [ ] Set up rate limiting
- [ ] Enable authentication on admin routes
- [ ] Regular security updates

## 🗄️ Database Migration

If moving from local to production:

```bash
# Export from local
mongodump --db tfs-wholesalers --out ./backup

# Import to Atlas
mongorestore --uri "your_atlas_connection_string" ./backup
```

## 📧 Email Configuration

### Using Gmail

1. Enable 2-factor authentication
2. Generate App Password
3. Use App Password in EMAIL_PASSWORD

### Using SendGrid (Recommended for Production)

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Generate API key
3. Update environment variables:
```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your_sendgrid_api_key
```

## 🧪 Testing Production

After deployment:

1. **Test User Flow**:
   - Browse products
   - Add to cart
   - Complete checkout
   - Receive confirmation email

2. **Test Admin**:
   - Login to /admin
   - Add a product
   - Update stock
   - View orders

3. **Test Payments**:
   - Use test cards for Paystack
   - Test Ozow integration
   - Verify webhooks

## 🔄 Continuous Deployment

### Automatic Deploys

Render and Vercel automatically deploy when you push to GitHub:

```bash
git add .
git commit -m "Update features"
git push origin main
# Automatically deploys!
```

## 📊 Monitoring

### Set Up Monitoring

1. Enable Render metrics
2. Set up error tracking (Sentry recommended)
3. Monitor MongoDB Atlas metrics
4. Set up uptime monitoring

### Important Metrics

- Response time
- Error rate
- Database connections
- Memory usage
- Successful orders

## 🆘 Troubleshooting

### Build Fails

```bash
# Clear cache and rebuild
rm -rf node_modules .next
npm install
npm run build
```

### Database Connection Issues

- Check MongoDB Atlas IP whitelist
- Verify connection string format
- Test connection locally first

### Payment Integration Issues

- Verify API keys are correct
- Check webhook URLs are set
- Test in sandbox mode first

### Email Not Sending

- Verify SMTP credentials
- Check spam folder
- Enable less secure apps (Gmail)

## 🔐 Backup Strategy

### Automated Backups

Set up MongoDB Atlas automated backups:

1. Go to Atlas dashboard
2. Clusters → Backup
3. Enable Cloud Backup
4. Set backup schedule

### Manual Backups

```bash
# Backup database
mongodump --uri "your_connection_string" --out ./backup-$(date +%Y%m%d)

# Backup to cloud storage
# Use AWS S3, Google Cloud Storage, etc.
```

## 📈 Scaling

### When to Scale

- Response time > 2 seconds
- Database CPU > 80%
- Memory usage > 80%
- > 1000 concurrent users

### Scaling Options

1. **Vertical**: Upgrade Render instance type
2. **Horizontal**: Add more instances (Pro plan)
3. **Database**: Upgrade MongoDB Atlas tier
4. **CDN**: Add Cloudflare for static assets

## ✅ Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Database connected and seeded
- [ ] Admin login working
- [ ] Products displaying correctly
- [ ] Cart functionality working
- [ ] Checkout process complete
- [ ] Payment integration tested
- [ ] Email notifications working
- [ ] Mobile responsive
- [ ] SSL/HTTPS enabled
- [ ] Error tracking set up
- [ ] Backups configured
- [ ] Monitoring enabled
- [ ] Domain connected (if applicable)

## 🌐 Custom Domain

### Render

1. Go to Settings → Custom Domains
2. Add your domain
3. Update DNS records as shown
4. Wait for SSL certificate (automatic)

### Vercel

1. Go to Settings → Domains
2. Add your domain
3. Update DNS records
4. SSL automatic

## 📞 Support

For deployment issues:
- Render: [render.com/docs](https://render.com/docs)
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- MongoDB: [docs.mongodb.com](https://docs.mongodb.com)

---

**Remember**: Always test in a staging environment before deploying to production!
