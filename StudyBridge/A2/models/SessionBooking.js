import mongoose from 'mongoose';
const sessionBookingSchema = new mongoose.Schema({
    learnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    tutorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
        required: true
    },

    slotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AvailabilitySlot",
        required: true
    },

    agreedRate: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: [
      "requested",
      "confirmed",
      "completed",
      "cancelled"
        ],
       default: "requested"
    },

    createdDate: {
        type: Date,
        default: Date.now
  }
});

const SessionBooking = mongoose.model(
  "SessionBooking",
  sessionBookingSchema
);

export default SessionBooking;

