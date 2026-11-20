import Image from 'next/image';
import type { ReactNode } from 'react';
import ImageWithFallback from './ImageWithFallback';

type Props = {
  title: string;
  subtitle?: string;
  image?: string;
  fallbackImage?: string;
  children?: ReactNode;
};

export default function PageHero({ title, subtitle, image, fallbackImage, children }: Props) {
  const imageProps = {
    alt: '',
    fill: true,
    priority: true,
    sizes: '(min-width: 1280px) 520px, (min-width: 768px) 42vw, 100vw',
    className: 'object-cover object-center',
  };

  return (
    <header className="border-b border-line bg-parchment">
      <div className={`site-container grid items-center gap-6 py-8 sm:py-11 lg:gap-12 lg:py-14 ${image ? 'md:grid-cols-[minmax(0,1.28fr)_minmax(0,1fr)]' : ''}`}>
        <div className="max-w-[43rem] border-t border-gold pt-5 md:pt-7">
          <h1 className="text-[clamp(2.05rem,4.4vw,3.85rem)] leading-[1.1] text-balance [overflow-wrap:anywhere]">
            {title}
          </h1>
          {subtitle && <p className="mt-4 max-w-xl text-base leading-relaxed sm:text-lg">{subtitle}</p>}
          {children && <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-6">{children}</div>}
        </div>
        {image && (
          <div className="relative aspect-[2.65/1] overflow-hidden bg-line md:aspect-[1.92/1]">
            {fallbackImage ? (
              <ImageWithFallback src={image} fallbackSrc={fallbackImage} {...imageProps} />
            ) : (
              <Image src={image} {...imageProps} />
            )}
          </div>
        )}
      </div>
    </header>
  );
}
