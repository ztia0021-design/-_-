import Subject from "../models/Subject.js";
export async function validateSubjects(subjects) {

    if (subjects.length === 0) {
        return {error: "At least one subject is required"};
    }

    for (const subjectId of subjects) {

        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return {error: `Invalid subject: ${subjectId}`};
        }
    }
    return { error: null};
}
