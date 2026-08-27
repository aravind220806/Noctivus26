export interface FaqItem {
  id: string;
  category: 'General' | 'Registration' | 'Events' | 'Logistics';
  question: string;
  answer: string;
}

export const faqCategories = ['General', 'Registration', 'Events', 'Logistics'] as const;

export const faqs: FaqItem[] = [
  // General
  {
    id: 'gen-1',
    category: 'General',
    question: 'What is NOCTIVUS \'26?',
    answer: 'NOCTIVUS \'26 is the annual national-level technical symposium organized by the Department of Computer Science & Engineering (Cyber Security) at Velammal Engineering College, Chennai.',
  },
  {
    id: 'gen-2',
    category: 'General',
    question: 'Who can participate in NOCTIVUS \'26?',
    answer: 'Students currently enrolled in any undergraduate or postgraduate degree program at a recognized college or university are eligible. Carry a valid college ID card on event day.',
  },
  {
    id: 'gen-3',
    category: 'General',
    question: 'Is there a general campus entry fee?',
    answer: 'No, campus entry is free. You only pay the specific registration fee for the individual technical or non-technical events you choose to compete in.',
  },

  // Registration
  {
    id: 'reg-1',
    category: 'Registration',
    question: 'How does team registration work?',
    answer: 'One team leader fills out the registration form with all team member details and completes the payment via UPI for the entire team in a single transaction.',
  },
  {
    id: 'reg-2',
    category: 'Registration',
    question: 'What payment methods are accepted?',
    answer: 'We support secure UPI payments via GPay, PhonePe, Paytm, and BHIM through dynamic QR codes and UTR verification.',
  },
  {
    id: 'reg-3',
    category: 'Registration',
    question: 'When is my registration seat confirmed?',
    answer: 'Your submission is initially marked as pending. Seats are confirmed once the organizing committee matches your UTR and transaction ID with the official bank statement. A confirmation receipt will be issued immediately.',
  },
  {
    id: 'reg-4',
    category: 'Registration',
    question: 'Can I register on the day of the event (spot registration)?',
    answer: 'Spot registration may be available depending on seat availability. However, pre-registration is strongly encouraged to guarantee your team slot.',
  },

  // Events
  {
    id: 'evt-1',
    category: 'Events',
    question: 'Can I register for multiple events?',
    answer: 'Yes! You can participate in multiple events as long as their reporting times and event schedules do not overlap. The detailed schedule timeline will be published prior to registration closing.',
  },
  {
    id: 'evt-2',
    category: 'Events',
    question: 'Do I need to bring my own laptop or hardware?',
    answer: 'For technical events like Cyber Heist CTF, Secure X VibeCode, and IoT Exploit, participants are advised to bring their own laptops with necessary developer tools and Wi-Fi capability. Specific requirements will be listed in the event rulebook.',
  },
  {
    id: 'evt-3',
    category: 'Events',
    question: 'Where can I find official event rules and guidelines?',
    answer: 'Detailed rulebooks and judging criteria for each of the 8 technical and non-technical events will be downloadable directly from the event details modal.',
  },

  // Logistics
  {
    id: 'log-1',
    category: 'Logistics',
    question: 'How do I reach the venue (Velammal Engineering College)?',
    answer: 'The college is located at Surapet, Chennai. It is easily accessible via MTC bus routes passing through Ambattur and Red Hills. Direct Google Maps navigation links are available on the venue section.',
  },
  {
    id: 'log-2',
    category: 'Logistics',
    question: 'Will food and refreshments be provided?',
    answer: 'Yes, food stalls and campus cafeterias will be open throughout the day. Lunch arrangements for registered participants will be detailed in the participant handbook.',
  },
  {
    id: 'log-3',
    category: 'Logistics',
    question: 'What items should I bring on event day?',
    answer: 'Bring your official College ID card, registration confirmation receipt (digital copy), laptop/chargers (if participating in technical events), and enthusiasm!',
  },
];
