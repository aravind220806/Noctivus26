/**
 * Noctivus '26 Coordinator Database Records
 * Classified personnel directory data architecture.
 */

export const facultyCoordinators = [
  {
    id: 'FAC-001',
    name: 'FACULTY COORDINATOR',
    role: 'FACULTY COORDINATOR',
    type: 'faculty',
    department: 'CSE (CYBER SECURITY)',
    designation: 'ASSISTANT PROFESSOR',
    image: '/images/noctivus-students.webp',
    email: 'faculty@velammal.edu.in',
    phone: '+91 88259 79172',
    accessLevel: 8,
    permissions: [
      'FACULTY SUPERVISION',
      'EVENT AUTHORIZATION',
      'STUDENT COORDINATION',
    ],
  },
];

export const studentCoordinators = [
  {
    id: 'STU-OC-0001',
    name: 'SARVERSHWARAN N',
    role: 'OVERALL COORDINATOR',
    type: 'student',
    department: 'CSE (CYBER SECURITY)',
    year: '3RD YEAR',
    accessLevel: 7,
    image: '/coordinators/aravind.webp',
    phone: '+91 98840 17375',
    permissions: [
      'COORDINATE ALL ACTIVITIES',
      'MANAGE EVENT OPERATIONS',
      'SUPERVISE STUDENT TEAMS',
    ],
  },
  {
    id: 'STU-OC-0002',
    name: 'BHAVANA M',
    role: 'OVERALL COORDINATOR',
    type: 'student',
    department: 'CSE (CYBER SECURITY)',
    year: '3RD YEAR',
    accessLevel: 7,
    image: '/coordinators/coordinator-2.webp',
    phone: '+91 98847 76861',
    permissions: [
      'COORDINATE ALL ACTIVITIES',
      'MANAGE EVENT OPERATIONS',
      'SUPERVISE STUDENT TEAMS',
    ],
  },
  {
    id: 'STU-OC-0003',
    name: 'MONICA S',
    role: 'OVERALL COORDINATOR',
    type: 'student',
    department: 'CSE (CYBER SECURITY)',
    year: '3RD YEAR',
    accessLevel: 7,
    image: '/coordinators/coordinator-3.webp',
    phone: '+91 93844 80681',
    permissions: [
      'COORDINATE ALL ACTIVITIES',
      'MANAGE EVENT OPERATIONS',
      'SUPERVISE STUDENT TEAMS',
    ],
  },
];

export const registrationCoordinators = [
  {
    id: 'REG-001',
    name: 'REGISTRATION DESK',
    role: 'REGISTRATION UNIT',
    type: 'registration',
    department: 'CSE (CYBER SECURITY)',
    year: '2ND YEAR',
    accessLevel: 3,
    image: '/images/noctivus-students.webp',
    email: 'noctivus26@velammal.edu.in',
    permissions: [
      'PARTICIPANT VERIFICATION',
      'PAYMENT CONFIRMATION',
      'ON-SPOT REGISTRATION',
    ],
  },
];
