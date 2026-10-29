import mongoose from "mongoose";
import bcrypt from "bcrypt";

import User from "./models/User.js";
import Subject from "./models/Subject.js";

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

async function seedDatabase() {

  if (!process.env.SEED_ADMIN_PASSWORD) throw new Error("Set SEED_ADMIN_PASSWORD before seeding");
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  
  await User.deleteMany({});

  const adminEmail = "admin@studybridge.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await User.create({
        fullName: "StudyBridge Admin",
        email: adminEmail,
        passwordHash: passwordHash,
        role: "admin"
      });

  await Subject.deleteMany({});
  await Subject.insertMany([
    {
        name: "Linear Algebra",
        category: "Mathematics",
        description: "Introduction to linear algebra"
      },
      {
        name: "Calculus",
        category: "Mathematics",
        description: "Introduction to calculus"
      },
      {
        name: "Data Structures",
        category: "Computer Science",
        description: "Introduction to data structures"
      },
      {
        name: "Web Development",
        category: "Computer Science",
        description: "Introduction to web development"
      },
      {
        name: "Chemistry",
        category: "Science",
        description: "Introduction to chemistry"
      }
  
    
  ]);
  await mongoose.disconnect();

   
}

seedDatabase();