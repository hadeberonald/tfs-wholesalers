import HeroSection from '@/components/home/HeroSection';
import SpecialsSection from '@/components/home/SpecialsSection';
import CategoriesSection from '@/components/home/CategoriesSection';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import WhyChooseUs from '@/components/home/WhyChooseUs';

export default function Home() {
  return (
    <div className="pt-20">
      <HeroSection />
      <SpecialsSection />
      <CategoriesSection />
      <FeaturedProducts />
    </div>
  );
}
