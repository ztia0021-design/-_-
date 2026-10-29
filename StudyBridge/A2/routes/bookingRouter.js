import express from "express";

import AvailabilitySlot from "../models/AvailabilitySlot.js";
import TutorProfile from "../models/TutorProfile.js";
import SessionBooking from "../models/SessionBooking.js";
import Review from "../models/Review.js";
import { verifyToken } from "../midAuth.js";
import { requireRole } from "../midRole.js";

const bookingRouter = express.Router();


bookingRouter.post("/", verifyToken, requireRole("learner"), async (req, res) => {

    const { slotId, subjectId } = req.body;

    if (!slotId || !subjectId) {
        return res.status(400).json({error: "slotId and subjectId are required"});
    }

    const slot = await AvailabilitySlot.findById(slotId);
    if (!slot) {
        return res.status(404).json({error: "Slot not found"});
    }

    const tutorProfile = await TutorProfile.findOne({userId: slot.tutorId});
    if (!tutorProfile) {
        return res.status(404).json({error: "Tutor profile not found"});
    }


       
    let teachesSubject = false;
    for (const subject of tutorProfile.subjects) {
        if (subject.toString() === subjectId.toString()) {
            teachesSubject = true;
            break;
    }

    }
    if (!teachesSubject) {
        return res.status(400).json({error: "Tutor does not teach this subject"});
    }


   
    const reservedSlot = await AvailabilitySlot.findOneAndUpdate(
        {_id: slotId, isBooked: false},
        { $set: { isBooked: true } },
        { new: true })
        


    if (!reservedSlot) {
        return res.status(409).json({error: "Slot is no longer available"});
    }


      
    const booking = await SessionBooking.create({
        learnerId: req.user.userId,
        tutorId: slot.tutorId,
        subjectId: subjectId,
        slotId: slotId,
        agreedRate: tutorProfile.hourlyRate,
        status: "requested"
        });


    req.app.get("io").emit("slot:booked", {
        slotId: booking.slotId,
        tutorId: booking.tutorId
    });

    return res.status(201).json(booking);
    }
);


bookingRouter.get("/mine", verifyToken, requireRole("learner", "tutor"), async (req, res) => {
    let mineBookings;
    if (req.user.role === "learner") {
        mineBookings = await SessionBooking.find({ learnerId: req.user.userId });
    } else if (req.user.role === "tutor") {
        mineBookings = await SessionBooking.find({ tutorId: req.user.userId });
    }
    return res.status(200).json(mineBookings);
}
);

bookingRouter.patch( "/:bookingId/confirm", verifyToken, requireRole("tutor"), async (req, res) => {
    const booking = await SessionBooking.findById( req.params.bookingId );
    if (!booking) {
        return res.status(404).json({error: "Booking not found" });
    }

    if ( req.user.userId.toString() !== booking.tutorId.toString() ) {
        return res.status(403).json({error: "Only the tutor who owns this booking can confirm it"});
    }

    if (booking.status !== "requested") {
        return res.status(409).json({error: `Cannot confirm booking with current status ${booking.status}`});
    }

    booking.status = "confirmed";
    await booking.save();
    return res.status(200).json(booking);
}
);

bookingRouter.patch("/:bookingId/complete", verifyToken, requireRole("tutor"), async (req, res) => {
    const booking = await SessionBooking.findById( req.params.bookingId );
    if (!booking) {
        return res.status(404).json({error: "Booking not found" });
    }

    if ( req.user.userId.toString() !== booking.tutorId.toString() ) {
        return res.status(403).json({error: "Only the tutor who owns this booking can complete it"});
    }

    if (booking.status !== "confirmed") {
        return res.status(409).json({error: `Cannot confirm booking with current status ${booking.status}`});
    }

    booking.status = "completed";
    await booking.save();
    return res.status(200).json(booking);
    }
);

bookingRouter.patch("/:bookingId/cancel", verifyToken, requireRole("tutor", "learner"), async (req, res) => {
    const booking = await SessionBooking.findById( req.params.bookingId );
    if (!booking) {
        return res.status(404).json({error: "Booking not found" });
    }

    if (req.user.role === "learner"){
        if ( req.user.userId.toString() !== booking.learnerId.toString() ) {
            return res.status(403).json({error: "Only the tutor and learner who owns this booking can complete it"});
    } }
    
    if (req.user.role === "tutor"){
        if ( req.user.userId.toString() !== booking.tutorId.toString() ) {
            return res.status(403).json({error: "Only the tutor and learner who owns this booking can complete it"});
    } }

    if ( booking.status !== "requested" && booking.status !== "confirmed")
    {
        return res.status(409).json({error: `Cannot cancel booking with current status ${booking.status}`});
    }

    booking.status = "cancelled";
    await booking.save();
    const slot = await AvailabilitySlot.findOneAndUpdate({ _id: booking.slotId, isBooked: true},
        { $set: { isBooked: false} },
        { new: true}
   );
    if (slot) {
        req.app.get("io").emit("slot:freed", {
            slotId: slot._id,
            tutorId: slot.tutorId
        });
    }
    return res.status(200).json(booking);
    }
);


bookingRouter.post( "/:bookingId/review", verifyToken, requireRole("learner"), async (req, res) => {
    const { bookingId } = req.params;
    const { rating, comment } = req.body;
    
    const booking = await SessionBooking.findById(bookingId);
    if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
    }

    if ( req.user.userId.toString() !== booking.learnerId.toString()) 
    {
        return res.status(403).json({ error: "You can only review your own booking" });
    }

    if (booking.status !== "completed") {
        return res.status(409).json({ error: `Cannot review booking with current status ${booking.status}`});
    }

    if ( !Number.isInteger(rating) || rating < 1 || rating > 5) 
    {
        return res.status(400).json({ error: "rating must be an integer between 1 and 5" });
    }

    if ( comment !== undefined && comment.length > 500) {
        return res.status(400).json({ error: "comment must not exceed 500 characters" });
    }

    const reviewIsExisting = await Review.findOne({ bookingId: bookingId });
    if (reviewIsExisting) {
        return res.status(409).json({ error: "This booking has already been reviewed" });
    }

    const review = await Review.create({ bookingId: booking._id,
        learnerId: booking.learnerId,
        tutorId: booking.tutorId,
        rating: rating,
        comment: comment
    });


    return res.status(201).json(review);
    }
);


export default bookingRouter;