import mongoose from "mongoose";
import { connectDB } from "../api/lib/db";
import User from "../api/models/User";

if (process.env.NODE_ENV === "production") {
  throw new Error("Seeding disabled in production");
}

async function seed() {
  await connectDB();

  await User.create({
    username: "admin",
    password: "admin",
    role: "admin",
  });

  console.log("Seed completed");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});