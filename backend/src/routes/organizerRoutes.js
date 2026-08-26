import express from 'express';
import { queueEmail, sendConfirmation } from '../services/emailService.js';
import { updateRegistration } from '../services/registrationService.js';

export const organizerRouter = express.Router();

organizerRouter.patch('/registrations/:id', async (request, response, next) => {
  try {
    const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!process.env.ORGANIZER_SECRET || provided !== process.env.ORGANIZER_SECRET) return response.status(401).json({ message: 'Organizer authorization required.' });
    const allowed = ['confirmed', 'mismatch', 'duplicate'];
    if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid registration status.' });
    const update = { paymentStatus: request.body.status, verifiedAt: new Date(), verifiedBy: 'organizer-api', verificationNotes: String(request.body.notes || '').slice(0, 500) };
    const registration = await updateRegistration(request.params.id, update);
    if (!registration) return response.status(404).json({ message: 'Registration not found.' });
    if (update.paymentStatus === 'confirmed') queueEmail(() => sendConfirmation(registration));
    return response.json({ registrationId: registration.registrationId, status: registration.paymentStatus });
  } catch (error) {
    return next(error);
  }
});
