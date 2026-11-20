import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { AreaItem } from '../../types';
import ServiceIcon from './ServiceIcon';

type Props = Pick<AreaItem, 'title' | 'description'> & {
  href: string;
  icon?: string;
  heading?: 'h2' | 'h3';
};

export default function PracticeAreaLink({ title, description, href, icon, heading: Heading = 'h3' }: Props) {
  return (
    <Link
      href={href}
      className="group grid h-full auto-rows-min grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 border-b border-line py-5 transition-colors hover:border-gold-dark focus-visible:border-gold-dark sm:py-6"
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && <ServiceIcon name={icon} />}
        <Heading className="text-xl leading-snug text-pretty transition-colors [overflow-wrap:anywhere] group-hover:text-gold-dark sm:text-[1.45rem]">
          {title}
        </Heading>
      </div>
      <ArrowUpRight aria-hidden="true" focusable="false" size={16} strokeWidth={1.5} className="mt-1.5 text-ink-muted group-hover:text-gold-dark" />
      <p className={`col-span-2 max-w-prose text-sm leading-relaxed ${icon ? 'pl-8' : ''}`}>{description}</p>
    </Link>
  );
}
