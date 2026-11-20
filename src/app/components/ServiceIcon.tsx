import {
  Anchor, Banknote, BriefcaseBusiness, Building2, Calculator, ClipboardCheck, Code,
  Construction, Cpu, FileText, Fish, Flame, Gavel, Globe, GraduationCap, Handshake,
  HeartPulse, Hotel, Landmark, Layers, Leaf, Lightbulb, LockKeyhole, Map, Megaphone,
  Mountain, Plane, Rocket, RotateCcw, Scale, Shield, ShieldCheck, Ship, Signal,
  Smartphone, Tag, TrendingUp, Truck, Umbrella, Users, Zap, type LucideIcon,
} from 'lucide-react';

const icons: Record<string, LucideIcon> = {
  anchor: Anchor,
  bank: Banknote,
  bolt: Zap,
  briefcase: BriefcaseBusiness,
  building: Building2,
  'building-gov': Landmark,
  calculator: Calculator,
  chart: TrendingUp,
  'check-shield': ShieldCheck,
  chip: Cpu,
  city: Building2,
  clipboard: ClipboardCheck,
  code: Code,
  crane: Construction,
  file: FileText,
  fish: Fish,
  flame: Flame,
  gavel: Gavel,
  globe: Globe,
  graduation: GraduationCap,
  handshake: Handshake,
  heartbeat: HeartPulse,
  hotel: Hotel,
  layers: Layers,
  leaf: Leaf,
  lightbulb: Lightbulb,
  lock: LockKeyhole,
  map: Map,
  megaphone: Megaphone,
  'mobile-pay': Smartphone,
  mountain: Mountain,
  plane: Plane,
  refresh: RotateCcw,
  rocket: Rocket,
  scale: Scale,
  shield: Shield,
  'shield-check': ShieldCheck,
  ship: Ship,
  signal: Signal,
  tag: Tag,
  truck: Truck,
  umbrella: Umbrella,
  users: Users,
};

export default function ServiceIcon({ name }: { name: string }) {
  const Icon = icons[name] ?? Scale;

  return <Icon aria-hidden="true" focusable="false" size={20} strokeWidth={1.5} className="mt-1 shrink-0 text-gold-dark" />;
}
