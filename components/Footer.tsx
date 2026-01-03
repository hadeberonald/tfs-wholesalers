import Link from 'next/link';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <Link href="/" className="flex items-center space-x-3 group">
  <div className="w-12 h-12 flex items-center justify-center transform group-hover:scale-105 transition-transform">
    <img src="/logo.png" alt="TFS Logo" className="w-full h-full object-contain" />
  </div>
</Link>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              Your trusted wholesale supplier for quality products at competitive prices. Serving businesses and bulk buyers across the region.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/products" className="text-gray-400 hover:text-brand-orange transition-colors">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-400 hover:text-brand-orange transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/specials" className="text-gray-400 hover:text-brand-orange transition-colors">
                  Special Offers
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-brand-orange transition-colors">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Customer Service</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/account/orders" className="text-gray-400 hover:text-brand-orange transition-colors">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/account" className="text-gray-400 hover:text-brand-orange transition-colors">
                  My Account
                </Link>
              </li>
              <li>
                <Link href="/delivery-info" className="text-gray-400 hover:text-brand-orange transition-colors">
                  Delivery Information
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-brand-orange transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Contact Us</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-brand-orange mt-0.5 flex-shrink-0" />
                <span className="text-gray-400 text-sm">+27 31 123 4567</span>
              </li>
              <li className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-brand-orange mt-0.5 flex-shrink-0" />
                <span className="text-gray-400 text-sm">info@tfswholesalers.co.za</span>
              </li>
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-brand-orange mt-0.5 flex-shrink-0" />
                <span className="text-gray-400 text-sm">123 Main Street<br />Durban, KZN 4001</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} TFS Wholesalers. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <Link href="/privacy" className="text-gray-400 hover:text-brand-orange transition-colors text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-brand-orange transition-colors text-sm">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
