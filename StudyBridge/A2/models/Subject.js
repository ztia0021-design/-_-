import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
    name: {
        type:String,
        required: true,
        unique: true,
    },
    category: {
        type: String,
        enum: ["Mathematics", "Computer Science", "Science", "Languages", "Business", "Other"],
        required: true
    },
    description: {
        type: String,
    },
    createdDate:{
        type: Date,
        default: Date.now
    }
});

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;
