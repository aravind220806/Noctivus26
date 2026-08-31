export const site = {
  eyebrow: 'Department of CSE (Cyber Security) presents',
  date: '26 September 2026',
  eventStart: '2026-09-26T09:00:00+05:30',
  contactEmail: 'noctivus26@velammal.edu.in',
  contactPhone: '+91 98765 43210',
  address: 'Velammal Engineering College, Ambattur-Red Hills Road, Surapet, Chennai, Tamil Nadu 600066',
  coordinates: {
    latitude: 13.1483288,
    longitude: 80.1916095,
  },
  social: {
    Instagram: 'https://www.instagram.com/noctivus_25',
    LinkedIn: 'https://www.linkedin.com/company/noctivus-symposium/',
    X: 'https://x.com/noctivussympo',
  },
};

const eventImage = '/images/noctivus-students.webp';

export const events = [
  {
    id: 'ideathon',
    name: 'Ideathon',
    category: 'Technical',
    fee: 200,
    accent: 'cyan',
    image: eventImage,
    imagePosition: '50% 42%',
    format: 'Pitch a practical technology solution from problem statement to execution plan.',
    details: ['Solo registration', 'Idea clarity, feasibility, and impact are judged', 'Presentation format and timing will be announced before event day'],
  },
  {
    id: 'cyber-heist-ctf',
    name: 'Cyber Heist CTF',
    category: 'Technical',
    fee: 200,
    accent: 'cyan',
    image: eventImage,
    imagePosition: '58% 45%',
    format: 'Solve security puzzles, exploit vulnerable systems, and climb the capture-the-flag scoreboard.',
    details: ['Solo registration', 'Bring your laptop', 'Challenges cover web, crypto, forensics, and fundamentals'],
  },
  {
    id: 'iot-exploit',
    name: 'IoT Exploit',
    category: 'Technical',
    fee: 200,
    accent: 'cyan',
    image: eventImage,
    imagePosition: '45% 50%',
    format: 'Analyze connected-device attack paths and solve IoT security tasks under time pressure.',
    details: ['Solo registration', 'Hardware/security fundamentals recommended', 'Final task brief will be shared at reporting'],
  },
  {
    id: 'secure-x-vibecode',
    name: 'Secure X VibeCode',
    category: 'Technical',
    fee: 200,
    accent: 'cyan',
    image: eventImage,
    imagePosition: '52% 38%',
    format: 'Build fast, defend smart, and ship a secure prototype from a surprise prompt.',
    details: ['Solo registration', 'Coding and product thinking round', 'Judged on security, usability, and completion'],
  },
  {
    id: 'mind-cage',
    name: 'Mind Cage',
    category: 'Technical',
    fee: 200,
    accent: 'cyan',
    image: eventImage,
    imagePosition: '48% 44%',
    format: 'A logic-first cyber challenge built around riddles, patterns, and layered clues.',
    details: ['Solo registration', 'No advanced tools required', 'Designed for fast reasoning and clean teamwork under pressure'],
  },
  {
    id: 'mystery-hunt',
    name: 'Mystery Hunt',
    category: 'Non-technical',
    fee: 150,
    accent: 'lime',
    image: eventImage,
    imagePosition: '56% 52%',
    format: 'Follow clues across rounds and solve a campus-scale mystery challenge.',
    details: ['Solo registration', 'Observation and speed matter', 'Reporting point will be shared in the final schedule'],
  },
  {
    id: 'tune-trap',
    name: 'Tune Trap',
    category: 'Non-technical',
    fee: 150,
    accent: 'lime',
    image: eventImage,
    imagePosition: '42% 46%',
    format: 'A music and memory challenge where quick recognition turns into points.',
    details: ['Solo registration', 'Multiple buzzer-style rounds', 'Final rules will be published with the brochure'],
  },
  {
    id: 'auction-arena',
    name: 'Auction Arena',
    category: 'Non-technical',
    fee: 150,
    accent: 'lime',
    image: eventImage,
    imagePosition: '54% 48%',
    format: 'Bid, bluff, budget, and build the strongest auction strategy across rapid rounds.',
    details: ['Solo registration', 'Non-technical strategy game', 'Round structure will be announced before the event'],
  },
  {
    id: 'cyber-awareness-workshop',
    name: 'Cyber Awareness Workshop',
    category: 'Workshops',
    fee: 0,
    accent: 'cyan',
    image: eventImage,
    imagePosition: '50% 50%',
    registerable: false,
    format: 'A guided session on everyday cyber safety, responsible reporting, and student security careers.',
    details: ['Open session', 'Limited seats based on hall capacity', 'Registration details will be announced separately'],
  },
];

export const timeline = [
  ['08:30 AM', 'Registration desk opens', 'Check in, collect your participant confirmation, and move to the inaugural venue.'],
  ['09:00 AM', 'Inauguration', 'Welcome address and Noctivus briefing in the main auditorium.'],
  ['09:30 AM', 'Technical events begin', 'CTF, Ideathon, IoT Exploit, Secure X VibeCode, and Mind Cage move into round one.'],
  ['11:30 AM', 'Non-technical rounds', 'Mystery Hunt, Tune Trap, and Auction Arena begin from their assigned venues.'],
  ['01:00 PM', 'Lunch break', 'Food counters open according to participant preference and event flow.'],
  ['02:00 PM', 'Final rounds', 'Shortlisted participants move into finals and judging.'],
  ['04:30 PM', 'Valedictory & awards', 'Winners, certificates, and closing ceremony.'],
];

export const brochure = {
  title: "Noctivus '26 Brochure",
  href: '/Noctivus26-brochure.pdf',
  note: 'Download link placeholder. Replace this with the approved PDF before launch.',
};

export const posters = [
  {
    title: 'Demo Cat Image',
    image: '/posters/demo-cat.svg',
    alt: 'Demo cat placeholder image',
  },
  {
    title: 'Demo Dog Image',
    image: '/posters/demo-dog.svg',
    alt: 'Demo dog placeholder image',
  },
  {
    title: 'Demo Cat and Dog',
    image: '/posters/demo-cat-dog.svg',
    alt: 'Demo cat and dog placeholder image',
  },
];

export const crew = [
  ['Faculty Coordinator', 'Department of CSE (Cyber Security)', 'faculty@velammal.edu.in'],
  ['Student Coordinator', 'Noctivus Organizing Team', '+91 98765 43210'],
  ['Registration Desk', 'Payments and confirmations', 'noctivus26@velammal.edu.in'],
];
