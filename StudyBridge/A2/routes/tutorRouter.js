import express from "express";
import mongoose from "mongoose";

import TutorProfile from "../models/TutorProfile.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import AvailabilitySlot from "../models/AvailabilitySlot.js";
import Review from "../models/Review.js";

import { verifyToken } from "../midAuth.js";
import { requireRole } from "../midRole.js";
import { validateSubjects } from "../tools/validateSubjects.js";

const tutorRouter = express.Router();



tutorRouter.post("/profile", verifyToken, requireRole("tutor"), async (req, res) => {
    const { bio, hourlyRate, subjects } = req.body;

    if (hourlyRate === undefined || subjects === undefined) {
        return res.status(400).json({error: "hourlyRate and subjects are required"});
    }

    if (hourlyRate < 5 || hourlyRate > 200) {
        return res.status(400).json({error: "hourlyRate must be between 5 and 200"});
    }

    if (bio && bio.length > 500) {
        return res.status(400).json({error: "bio must not exceed 500 characters"});
    }

    const existingProfile = await TutorProfile.findOne({userId: req.user.userId});
    if (existingProfile) {
        return res.status(409).json({error: "Tutor profile already exists"});
    }   

    const subjectCheck = await validateSubjects(subjects);

    if (subjectCheck.error) {
        return res.status(400).json({error: subjectCheck.error});
    }

    const profile = await TutorProfile.create({userId: req.user.userId,
        bio,
        hourlyRate,
        subjects
    });

    return res.status(201).json(profile);
}
);


tutorRouter.put("/profile",verifyToken,requireRole("tutor"),async (req, res) => {
    const { bio, hourlyRate, subjects } = req.body;
    if (hourlyRate === undefined || subjects === undefined) {
        return res.status(400).json({error: "hourlyRate and subjects are required"});
    }

    if (hourlyRate < 5 || hourlyRate > 200) {
        return res.status(400).json({error: "hourlyRate must be between 5 and 200"});
    }

    if (bio && bio.length > 500) {
        return res.status(400).json({error: "bio must not exceed 500 characters"});
    }

    const profile = await TutorProfile.findOne({userId: req.user.userId});

    if (!profile) {
        return res.status(404).json({error: "Tutor profile not found"});
    }

    const subjectCheck = await validateSubjects(subjects);

    if (subjectCheck.error) {
        return res.status(400).json({error: subjectCheck.error});
    }

    profile.bio = bio ?? "";
    profile.hourlyRate = hourlyRate;
    profile.subjects = subjects;

    await profile.save();
        return res.status(200).json(profile);
    
    }
);
tutorRouter.get("/search", verifyToken, async (req, res) => {

    const {
        subject,
        minPrice,
        maxPrice,
        minRating,
        availableThisWeek
    } = req.query;

    const pipeline = [];
    pipeline.push({
        $lookup: {
            from: "subjects",
            localField: "subjects",
            foreignField: "_id",
            as: "subjects"
        }
    });


    if (subject) {
        pipeline.push({
            $match: { "subjects.name": new RegExp(`^${subject.trim()}$`, "i")}
        });
    }

    const priceRange = {};

    if ( minPrice !== undefined && minPrice !== "" && !Number.isNaN(Number(minPrice))) {
        priceRange.$gte = Number(minPrice);
    }

    if ( maxPrice !== undefined && maxPrice !== "" && !Number.isNaN(Number(maxPrice))) {
        priceRange.$lte = Number(maxPrice);
    }

    if (Object.keys(priceRange).length > 0) {
        pipeline.push({
            $match: {hourlyRate: priceRange}
        });
    }


    pipeline.push({
        $lookup: {
            from: "reviews",
            localField: "userId",
            foreignField: "tutorId",
            as: "reviews"
        }
    });


    pipeline.push({
        $addFields: {
            averageRating: {$avg: "$reviews.rating"},
            reviewCount: { $size: "$reviews"}
        }
    });


    if ( minRating !== undefined && minRating !== "" && !Number.isNaN(Number(minRating))) 
    {
        pipeline.push({
            $match: {
                averageRating: { $gte: Number(minRating)}
            }
        });
    }


    if (availableThisWeek === "true") {

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);


        pipeline.push({
            $lookup: {
                from: "availabilityslots",
                localField: "userId",
                foreignField: "tutorId",
                as: "availableSlots"
            }
        });


        pipeline.push({
            $unwind: "$availableSlots"
        });


        pipeline.push({
            $match: {
                "availableSlots.isBooked": false,
                "availableSlots.date": {
                    $gte: today,
                    $lte: endDate
                }
            }
        });


        pipeline.push({
            $group: {
                _id: {
                    profileId: "$_id",
                    userId: "$userId",
                    bio: "$bio",
                    hourlyRate: "$hourlyRate",
                    subjects: "$subjectDocs",
                    averageRating: "$averageRating",
                    reviewCount: "$reviewCount"
                }
            }
        });


        pipeline.push({
            $project: {
                _id: "$_id.profileId",
                userId: "$_id.userId",
                bio: "$_id.bio",
                hourlyRate: "$_id.hourlyRate",
                subjectDocs: "$_id.subjects",
                averageRating: "$_id.averageRating",
                reviewCount: "$_id.reviewCount"
            }
        });
    }


    pipeline.push({
        $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
        }
    });


    pipeline.push({
        $unwind: "$user"
    });


    pipeline.push({
        $sort: {
            averageRating: -1
        }
    });


    pipeline.push({
        $project: {
            _id: 0,
            userId: 1,
            fullName: "$user.fullName",
            bio: 1,
            hourlyRate: 1,
            subjects: "$subjects.name",
            averageRating: 1,
            reviewCount: 1
        }
    });


    const tutors = await TutorProfile.aggregate(pipeline);

    return res.status(200).json(tutors);
}); 


tutorRouter.get("/:userId",verifyToken,async (req, res) => {

    const { userId } = req.params;
    const profile = await TutorProfile.findOne({ userId }).populate("subjects", "name");

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({error: "Invalid userId"});
    }
       
    

    if (!profile) {
        return res.status(404).json({error: "Tutor profile not found"});
    }

    const user = await User.findById(userId);
    const ratingResult = await Review.aggregate([
        {
            $match: {tutorId: new mongoose.Types.ObjectId(userId)}
        },
        {
            $group: {_id: "$tutorId",
                    averageRating: {$avg: "$rating"},
                    reviewCount: {$sum: 1}
                    }
        }
    ]);

    let averageRating = null;
    let reviewCount = 0;

    if (ratingResult.length > 0) {
        averageRating = ratingResult[0].averageRating;
        reviewCount = ratingResult[0].reviewCount;
    }

    const availableSlots = await AvailabilitySlot.find({tutorId: userId,isBooked: false});
    const reviews = await Review.find({tutorId: userId}).select("rating comment createdDate");

    return res.status(200).json({
        fullName: user.fullName,
        bio: profile.bio,
        hourlyRate: profile.hourlyRate,
        subjects: profile.subjects.map(subject => subject.name),
        averageRating,
        reviewCount,
        availableSlots,
        reviews
        });
}
);




export default tutorRouter;