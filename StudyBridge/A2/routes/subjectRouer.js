import express from "express";


import TutorProfile from "../models/TutorProfile.js";
import Subject from "../models/Subject.js";

import SessionBooking from "../models/SessionBooking.js";

import { verifyToken } from "../midAuth.js";
import { requireRole } from "../midRole.js";


const subjectRouter = express.Router();
const validCategories = ["Mathematics", "Computer Science", "Science", "Languages", "Business", "Other"];
subjectRouter.post("/", verifyToken, requireRole("admin"), async (req, res) => {
    const { name, category, description } = req.body;

    if (!name || !category) {
        return res.status(400).json({error: "name and category are required"});
    }

    if (!validCategories.includes(category)) {
        return res.status(400).json({error: "Invalid category"});
    }
  
    const duplicate = await Subject.findOne({name: new RegExp("^" + name.trim() + "$", "i")});

    if (duplicate) {
        return res.status(409).json({error: "Subject name already exists"});
    }

    const subject = await Subject.create({
        name: name,
        category,
        description
    });

        return res.status(201).json(subject);
    }
);

subjectRouter.get("/", verifyToken, async (req, res) => {
    const subjects = await Subject.find();
    return res.status(200).json(subjects);
});

subjectRouter.get("/:subjectId", verifyToken, async (req, res) => {

    const subject = await Subject.findById(req.params.subjectId);

    if (!subject) {
        return res.status(404).json({error: "Subject not found"});
    }else{
        return res.status(200).json(subject);
    }

});

subjectRouter.put( "/:subjectId", verifyToken, requireRole("admin"), async (req, res) => {

    const { subjectId } = req.params;
    const { name, category, description } = req.body;

      
    if (!name || !category) {
        return res.status(400).json({error: "name and category are required"});
    }

    if (!validCategories.includes(category)) {
        return res.status(400).json({error: "Invalid category"});
    }

    const subject = await Subject.findById(subjectId);

    if (!subject) {
        return res.status(404).json({error: "Subject not found"});
    }

    const duplicate = await Subject.findOne({name: new RegExp("^" + name + "$", "i"), _id: { $ne: subjectId }});

    if (duplicate) {
        return res.status(409).json({error: "Subject name already exists"});}

    subject.name = name;
    subject.category = category;
    subject.description = description ?? "";
    await subject.save();

    return res.status(200).json(subject);
}
);

subjectRouter.delete("/:subjectId",verifyToken, requireRole("admin"), async (req, res) => {

    const { subjectId } = req.params;
    const subject = await Subject.findById(subjectId);
    if (!subject) {
        return res.status(404).json({ error: "Subject does not exist"});
    }

       
    const tutorProfileSubject = await TutorProfile.findOne({subjects: subjectId});

    if (tutorProfileSubject) {
        return res.status(409).json({error: "Subject is in use by a tutor profile"});
    }

    const bookingSubject = await SessionBooking.findOne({subjectId: subjectId});

    if (bookingSubject) {
        return res.status(409).json({error: "Subject is in use by a session booking"});
    }

    await Subject.findByIdAndDelete(subjectId);

    return res.status(200).json({message: "Subject is deleted"});
    }
);

export default subjectRouter;