export const eventCatalog = [
  { id: 'ideathon', name: 'Ideathon', category: 'Technical', fee: 200, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'cyber-heist-ctf', name: 'Cyber Heist CTF', category: 'Technical', fee: 200, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'iot-exploit', name: 'IoT Exploit', category: 'Technical', fee: 200, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'secure-x-vibecode', name: 'Secure X VibeCode', category: 'Technical', fee: 200, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'mind-cage', name: 'Mind Cage', category: 'Technical', fee: 200, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'mystery-hunt', name: 'Mystery Hunt', category: 'Non-technical', fee: 150, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'tune-trap', name: 'Tune Trap', category: 'Non-technical', fee: 150, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
  { id: 'auction-arena', name: 'Auction Arena', category: 'Non-technical', fee: 150, teamMin: 1, teamMax: 1, detailsComplete: true, status: 'open' },
];

export const eventsById = new Map(eventCatalog.map((event) => [event.id, event]));
