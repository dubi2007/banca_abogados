'use client';

import Image, { type ImageProps } from 'next/image';
import { useState } from 'react';

type Props = Omit<ImageProps, 'src' | 'onError'> & {
  src: string;
  fallbackSrc: string;
};

export default function ImageWithFallback({ src, fallbackSrc, ...props }: Props) {
  const [failedSrc, setFailedSrc] = useState<string>();

  return (
    <Image
      {...props}
      src={failedSrc === src ? fallbackSrc : src}
      onError={() => setFailedSrc(src)}
    />
  );
}
