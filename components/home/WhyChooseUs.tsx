import { Truck, Shield, Clock, Tag } from 'lucide-react';

const features = [
  {
    icon: Tag,
    title: 'Wholesale Prices',
    description: 'Competitive pricing on bulk orders for maximum savings'
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    description: 'Quick and reliable delivery across the region'
  },
  {
    icon: Shield,
    title: 'Quality Assured',
    description: 'Only the best products from trusted suppliers'
  }
];

export default function WhyChooseUs() {
  return (
    <section className="section-padding bg-brand-black text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl mb-4">
            Why Choose TFS Wholesalers
          </h2>
          <p className="text-gray-300 text-lg">
            Your trusted partner for wholesale success
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="text-center">
                <div className="w-16 h-16 bg-brand-orange rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-xl mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
