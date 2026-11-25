export const contactLimits = {
  name: 120,
  email: 254,
  phone: 32,
  message: 5000,
};

export const contactServices = ['corporate', 'tax', 'litigation', 'other'] as const;

export function buildWhatsAppHref(phone: string, message: string) {
  const number = phone.replace(/\D/g, '');
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
