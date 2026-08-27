import { events as canonicalEvents, type EventItem } from './events';

export interface SiteConfig {
  edition: string;
  eyebrow: string;
  tagline: string;
  date: string;
  eventStart: string;
  venue: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  registrationDeadline: string;
  contactEmail: string;
  contactPhone: string;
  social: Record<string, string>;
}

export type SiteEvent = EventItem;
export const events = canonicalEvents;

export const site: SiteConfig = {
  edition: "NOCTIVUS '26",
  eyebrow: 'Department of CSE · Cyber Security presents',
  tagline: 'National-level technical symposium',
  date: '26 September 2026',
  eventStart: '2026-09-26T00:00:00+05:30',
  venue: 'Velammal Engineering College, Chennai',
  address: 'Velammal New-Gen Park, Ambattur–Red Hills Road, Surapet, Chennai 600066, Tamil Nadu',
  coordinates: { latitude: 13.1483288, longitude: 80.1916095 },
  registrationDeadline: 'Opening soon',
  contactEmail: 'noctivus@velammal.edu.in',
  contactPhone: '+91 98765 43210',
  social: {
    instagram: 'https://www.instagram.com/noctivus_25',
    linkedin: 'https://www.linkedin.com/company/noctivus-symposium/',
    x: 'https://x.com/noctivussympo',
  },
};



export const faqs: [string, string][] = [
  ['Who can participate?', 'Students from any recognized college may participate. Carry a valid college ID on the event day.'],
  ['Can I join more than one event?', 'Yes, where schedules do not overlap. The final schedule will clearly mark conflicting events before registration opens.'],
  ['How does team registration work?', 'One captain enters the complete team and makes a single payment for that team registration.'],
  ['When is my seat confirmed?', 'Your submission first remains pending. It is confirmed only after the organizers match the UTR and amount with the bank statement.'],
  ['Will I receive an email?', 'Yes. A registration receipt is shown immediately, and the final confirmation email is sent after payment verification.'],
  ['What should I bring?', 'College ID, your confirmation message, and any event-specific equipment mentioned in the rulebook.'],
];
