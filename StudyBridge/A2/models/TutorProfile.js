import mongoose from "mongoose";

const tutorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  bio: {
    type: String,
    maxlength: 500
  },

  hourlyRate: {
    type: Number,
    required: true,
    min: 5,
    max: 200
  },

  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject"
  }],

  createdDate: {
    type: Date,
    default: Date.now
  }
});

const TutorProfile = mongoose.model("TutorProfile", tutorProfileSchema);

export default TutorProfile;