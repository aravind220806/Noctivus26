import { BionisIcons } from './icons';

export const navigationGroups = [
  {
    label: 'WORKSPACE',
    items: [
      { label: 'Dashboard', icon: BionisIcons.dashboard },
      { label: 'Verify Members', icon: BionisIcons.verify },
      { label: 'Check-in', icon: BionisIcons.checkIn },
      { label: 'Events', icon: BionisIcons.events },
      { label: 'Event Scheduler', icon: BionisIcons.events },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Invitations', icon: BionisIcons.invitations },
      { label: 'Announcements', icon: BionisIcons.announcements },
      { label: 'AI Analysis', icon: BionisIcons.analysis },
      { label: 'Export', icon: BionisIcons.export },
      { label: 'Audit Log', icon: BionisIcons.audit },
      { label: 'Admin Access', icon: BionisIcons.access },
    ],
  },
];
