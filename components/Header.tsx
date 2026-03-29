'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingCart, User, Menu, X, Search, LogOut, MapPin, ChevronDown } from 'lucide-react';
import { useCartStore } from '../lib/store';
import { useAuth } from '../lib/auth-context';

interface Branch {
  _id: string;
  name: string;
  slug: string;
  displayName: string;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  
  const slugFromUrl = useMemo(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const firstPart = pathParts[0];
      if (!['admin', 'login', 'register', 'super-admin', 'select-branch'].includes(firstPart)) {
        return firstPart;
      }
    }
    return null;
  }, [pathname]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  
  const cartItems = useCartStore((state) => state.items);
  const cartItemCount = cartItems.reduce((sum, item) => item.autoAdded ? sum : sum + item.quantity, 0);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (slugFromUrl) {
      fetchBranches(slugFromUrl);
    } else {
      fetchBranches();
    }
  }, [slugFromUrl]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (branchMenuRef.current && !branchMenuRef.current.contains(event.target as Node)) {
        setIsBranchMenuOpen(false);
      }
    };

    if (isBranchMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBranchMenuOpen]);

  const fetchBranches = async (currentSlug?: string) => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data.branches);
        
        if (currentSlug) {
          const branch = data.branches.find((b: Branch) => b.slug === currentSlug);
          setCurrentBranch(branch || null);
        } else {
          const savedBranch = localStorage.getItem('selectedBranch');
          if (savedBranch) {
            const branch = data.branches.find((b: Branch) => b.slug === savedBranch);
            setCurrentBranch(branch || null);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const handleBranchChange = (branchSlug: string) => {
    localStorage.setItem('selectedBranch', branchSlug);
    setIsBranchMenuOpen(false);
    
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length > 0 && branches.some(b => b.slug === pathParts[0])) {
      pathParts[0] = branchSlug;
      router.push('/' + pathParts.join('/'));
    } else {
      router.push(`/${branchSlug}`);
    }
  };

  const handleLogout = () => {
    logout();
    const destination = slugFromUrl ? `/${slugFromUrl}/login` : '/select-branch';
    router.push(destination);
  };

  const hideBranchSelector = pathname.startsWith('/super-admin') || 
                             pathname.startsWith('/select-branch') ||
                             pathname === '/login' || 
                             pathname === '/register';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white/95 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={currentBranch ? `/${currentBranch.slug}` : '/select-branch'} className="flex items-center space-x-2 group">
            <div className="w-12 h-12 flex items-center justify-center transform group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="TFS Logo" className="w-full h-full object-contain" />
            </div>
          </Link>

          {/* Branch Selector - Desktop */}
          {!hideBranchSelector && currentBranch && (
            <div className="hidden lg:block relative" ref={branchMenuRef}>
              <button
                onClick={() => setIsBranchMenuOpen(!isBranchMenuOpen)}
                className="flex items-center space-x-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
              >
                <MapPin className="w-4 h-4 text-brand-orange" />
                <span className="text-sm font-semibold text-brand-black">{currentBranch.name}</span>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isBranchMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isBranchMenuOpen && (
                <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 min-w-[200px] animate-fade-in">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium uppercase">Select Branch</p>
                  </div>
                  {branches.map((branch) => (
                    <button
                      key={branch._id}
                      onClick={() => handleBranchChange(branch.slug)}
                      className={`w-full text-left px-4 py-2 hover:bg-orange-50 transition-colors ${
                        currentBranch.slug === branch.slug ? 'bg-orange-50 text-brand-orange font-semibold' : 'text-gray-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{branch.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link 
              href={currentBranch ? `/${currentBranch.slug}` : '/select-branch'} 
              className="text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
            >
              Home
            </Link>
            <Link 
              href={currentBranch ? `/${currentBranch.slug}/shop` : '/select-branch'} 
              className="text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
            >
              Shop
            </Link>
            <Link 
              href={currentBranch ? `/${currentBranch.slug}/specials` : '/select-branch'} 
              className="text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
            >
              Specials
            </Link>
            {user?.role === 'admin' && (
              <Link 
                href={currentBranch ? `/${currentBranch.slug}/admin` : '/admin'} 
                className="text-brand-orange hover:text-orange-600 transition-colors font-semibold text-sm"
              >
                Admin
              </Link>
            )}
            {user?.role === 'super-admin' && (
              <Link 
                href="/super-admin" 
                className="text-purple-600 hover:text-purple-700 transition-colors font-semibold text-sm"
              >
                Super Admin
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Link 
              href={currentBranch ? `/${currentBranch.slug}/search` : '/select-branch'} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-brand-black" />
            </Link>

            {user ? (
              <>
                <Link 
                  href={user.role === 'admin' && currentBranch ? `/${currentBranch.slug}/admin` : user.role === 'super-admin' ? '/super-admin' : '/account'} 
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex items-center space-x-2"
                  aria-label="Account"
                >
                  <User className="w-5 h-5 text-brand-black" />
                  <span className="text-sm font-medium text-brand-black hidden md:block">
                    {user.name}
                  </span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex"
                  aria-label="Logout"
                >
                  <LogOut className="w-5 h-5 text-brand-black" />
                </button>
              </>
            ) : (
              <Link 
                href={slugFromUrl ? `/${slugFromUrl}/login` : '/select-branch'} 
                className="btn-primary text-sm px-3 py-1.5 hidden sm:flex"
              >
                Sign In
              </Link>
            )}

            <Link 
              href={currentBranch ? `/${currentBranch.slug}/cart` : '/select-branch'} 
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
            {/* Branch Selector - Mobile */}
            {!hideBranchSelector && currentBranch && (
              <div className="pb-3 mb-3 border-b border-gray-200">
                <p className="text-xs text-gray-500 font-medium uppercase mb-2">Current Branch</p>
                <div className="space-y-1">
                  {branches.map((branch) => (
                    <button
                      key={branch._id}
                      onClick={() => {
                        handleBranchChange(branch.slug);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        currentBranch.slug === branch.slug 
                          ? 'bg-orange-50 text-brand-orange font-semibold' 
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{branch.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Link 
              href={currentBranch ? `/${currentBranch.slug}` : '/select-branch'} 
              className="block py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link 
              href={currentBranch ? `/${currentBranch.slug}/shop` : '/select-branch'} 
              className="block py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
              onClick={() => setIsMenuOpen(false)}
            >
              Shop
            </Link>
            <Link 
              href={currentBranch ? `/${currentBranch.slug}/specials` : '/select-branch'} 
              className="block py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
              onClick={() => setIsMenuOpen(false)}
            >
              Specials
            </Link>
            {user?.role === 'admin' && (
              <Link 
                href={currentBranch ? `/${currentBranch.slug}/admin` : '/admin'} 
                className="block py-2 text-brand-orange hover:text-orange-600 transition-colors font-semibold text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                Admin Dashboard
              </Link>
            )}
            {user?.role === 'super-admin' && (
              <Link 
                href="/super-admin" 
                className="block py-2 text-purple-600 hover:text-purple-700 transition-colors font-semibold text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                Super Admin
              </Link>
            )}
            
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <Link 
                href={currentBranch ? `/${currentBranch.slug}/search` : '/select-branch'} 
                className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                <Search className="w-5 h-5" />
                <span>Search</span>
              </Link>
              {user ? (
                <>
                  <Link 
                    href={user.role === 'admin' && currentBranch ? `/${currentBranch.slug}/admin` : user.role === 'super-admin' ? '/super-admin' : '/account'} 
                    className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium text-sm"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <User className="w-5 h-5" />
                    <span>My Account ({user.name})</span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center space-x-2 py-2 text-brand-black hover:text-brand-orange transition-colors font-medium w-full text-left text-sm"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </>
              ) : (
                <Link 
                  href={slugFromUrl ? `/${slugFromUrl}/login` : '/select-branch'} 
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