import express from "express";



import TutorProfile from "../models/TutorProfile.js";
import AvailabilitySlot from "../models/AvailabilitySlot.js";


import { formatTime } from "../tools/formatTime.js"
import { verifyToken } from "../midAuth.js";
import { requireRole } from "../midRole.js";


const slotRouter = express.Router();

slotRouter.post("/",verifyToken,requireRole("tutor"), async (req, res) => {

    const { date, startTime, durationMinutes } = req.body;
    if (!date || !startTime || durationMinutes === undefined) {
        return res.status(400).json({error: "date, startTime and durationMinutes are required"});
    }

        
    if (typeof durationMinutes !== "number" ||durationMinutes < 30 ||durationMinutes > 180) {
        return res.status(400).json({error: "durationMinutes must be between 30 and 180"});
    }

        
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
        return res.status(400).json({error: "startTime must be in HH:MM format"});}

      
    const tutorProfile = await TutorProfile.findOne({userId: req.user.userId});

    if (!tutorProfile) {
        return res.status(409).json({error: "Tutor profile must be created before publishing slots"});
    }

      
    const slotDate = new Date(date);

    if (isNaN(slotDate.getTime())) {
        return res.status(400).json({error: "Invalid date"});
    }

        
    const existingSlots = await AvailabilitySlot.find({tutorId: req.user.userId,date: slotDate});

    let conflictSlot = null;

    for (const existing of existingSlots) {

        const [newStart, newEnd] = formatTime(startTime, durationMinutes);
        const [existStart, existEnd] = formatTime(existing.startTime,existing.durationMinutes);

        if (newStart < existEnd &&newEnd > existStart)
            {
                conflictSlot = existing;
                break;
            }
        }

  
        if (conflictSlot) {
            return res.status(409).json({error:`this overlaps your existing slot on ${date} ` +
                `at ${conflictSlot.startTime} ` +
                `(${conflictSlot.durationMinutes} minutes)`
        });
        }

   
    const slot = await AvailabilitySlot.create({
        tutorId: req.user.userId,
        date: slotDate,
        startTime,
        durationMinutes
    });

        
    return res.status(201).json(slot);
    }
);


slotRouter.get("/mine", verifyToken, requireRole("tutor"), async (req, res) => {

    const slots = await AvailabilitySlot.find({tutorId: req.user.userId});

    if (!slots) {
        return res.status(404).json({error: "Slots not found"});
    }else{
        return res.status(200).json(slots);
    }

});

slotRouter.delete("/:slotId", verifyToken, requireRole("tutor"), async (req, res) => {
    const { slotId } = req.params;
    const slot = await AvailabilitySlot.findById(slotId);
    if (!slot) {
        return res.status(404).json({error: "Slot not found"});
    }

    if (req.user.userId.toString() !== slot.tutorId.toString()) {
        return res.status(403).json({error: "You do not have permission to delete this slot"});
        }


    if (slot.isBooked) {
        return res.status(409).json({error: "Booked slot cannot be deleted"});
    }


    await AvailabilitySlot.findByIdAndDelete(slotId);
    return res.status(200).json({message: "Slot deleted"});
}
);





export default slotRouter;