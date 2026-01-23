import HeroSection from '../components/home/HeroSection';
import SpecialsSection from '../components/home/SpecialsSection';
import CategoriesSection from '../components/home/CategoriesSection';
import FeaturedProducts from '../components/home/FeaturedProducts';
import WhyChooseUs from '../components/home/WhyChooseUs';
import FeaturedCategoriesCarousel from '@/components/FeaturedCategoriesCarousel';

export default function Home() {
  return (
    <div className="pt-20">
      <FeaturedCategoriesCarousel />
      <SpecialsSection />
      <FeaturedProducts />
      
    </div>
  );
}
