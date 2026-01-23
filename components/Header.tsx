'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, User, Menu, X, Search, LogOut } from 'lucide-react';
import { useCartStore } from '../lib/store';
import { useAuth } from '../lib/auth-context';

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const cartItems = useCartStore((state) => state.items);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white/95 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Smaller */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="w-12 h-12 flex items-center justify-center transform group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="TFS Logo" className="w-full h-full object-contain" />
            </div>
            
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link href="/" className="text-brand-black hover:text-brand-orange transition-colors font-medium text-sm">
              Home
            </Link>
            <Link href="/shop" className="text-brand-black hover:text-brand-orange transition-colors font-medium text-sm">
              Shop
            </Link>
            
            <Link href="/specials" className="text-brand-black hover:text-brand-orange transition-colors font-medium text-sm">
              Specials
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className="text-brand-orange hover:text-orange-600 transition-colors font-semibold text-sm">
                Admin
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link 
              href="/search" 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-brand-black" />
            </Link>

            {user ? (
              <>
                <Link 
                  href={user.role === 'admin' ? '/admin' : '/account'} 
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex items-center space-x-2"
                  aria-label="Account"
                >
                  <User className="w-5 h-5 text-brand-black" />
                  <span className="text-sm font-medium text-brand-black hidden md:block">
                    {user.name}
                  </span>
                </Link>

                <button
                  onClick={() => logout()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5 text-brand-black" />
                </button>
              </>
            ) : (
              <Link 
                href="/login" 
                className="btn-primary text-sm px-3 py-1.5 hidden sm:flex"
              >
                Sign In
              </Link>
            )}

            <Link 
              href="/cart" 
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 text-brand-black" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-brand-orange text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Menu"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6 text-brand-black" />
              ) : (
                <Menu className="w-6 h-6 text-brand-black" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200">
          <nav className="max-w-7xl mx-auto px-4 py-4 space-y-2">
            <Link 
              href="/" 
              className="block py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href="/shop" 
              className="block py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
              onClick={() => setIsMenuOpen(false)}
            >
              shop
            </Link>
            
            <Link 
              href="/specials" 
              className="block py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
              onClick={() => setIsMenuOpen(false)}
            >
              Specials
            </Link>
            {user?.role === 'admin' && (
              <Link 
                href="/admin" 
                className="block py-2 text-brand-orange hover:text-orange-600 transition-colors font-semibold text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                Admin Dashboard
              </Link>
            )}
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <Link 
                href="/search" 
                className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                <Search className="w-5 h-5" />
                <span>Search</span>
              </Link>
              {user ? (
                <>
                  <Link 
                    href={user.role === 'admin' ? '/admin' : '/account'} 
                    className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    <span>My Account ({user.name})</span>
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium w-full text-left text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <Link 
                  href="/login" 
                  className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <User className="w-5 h-5" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}