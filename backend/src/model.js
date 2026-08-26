import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema({ name: String, rollNo: String }, { _id: false });
const eventRegistrationSchema = new mongoose.Schema({
  eventId: { type: String, required: true }, eventName: String, category: String,
  feeSnapshot: Number, teamSize: Number, teamSizeMin: Number, teamSizeMax: Number,
  teamMembers: [teamMemberSchema],
}, { _id: false });

const registrationSchema = new mongoose.Schema({
  registrationId: { type: String, required: true, unique: true, index: true },
  participant: { name: String, email: String, phone: String, college: String, foodPreference: { type: String, enum: ['veg', 'non-veg'] } },
  normalized: { email: { type: String, index: true }, phone: String, rollNo: String },
  eventRegistrations: [eventRegistrationSchema],
  paymentStatus: { type: String, enum: ['pending', 'confirmed', 'mismatch', 'duplicate'], default: 'pending', index: true },
  utrNumber: String,
  normalizedUtr: { type: String, required: true, unique: true, index: true },
  paymentReference: { type: String, required: true, index: true },
  expectedAmount: Number,
  claimedAmount: Number,
  paymentSubmittedAt: Date,
  verifiedAt: Date,
  verifiedBy: String,
  verificationNotes: String,
  invitation: {
    sentAt: Date,
    sentBy: String,
    passTitle: String,
    passFields: mongoose.Schema.Types.Mixed,
  },
  consent: { privacyAccepted: Boolean, rulesAccepted: Boolean, acceptedAt: Date },
}, { timestamps: true, versionKey: false });

const adminAccessSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  name: String,
  tabs: [{ type: String }],
  active: { type: Boolean, default: true, index: true },
  createdBy: String,
  updatedBy: String,
}, { timestamps: true, versionKey: false });

export const Registration = mongoose.model('Registration', registrationSchema);
export const AdminAccess = mongoose.model('AdminAccess', adminAccessSchema);
