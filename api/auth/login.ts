import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectDB } from "../lib/db.js";
import User from "../models/User.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    await connectDB();

    // Vercel sometimes sends body as string
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { username, password } = body || {};

    if (!username || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    // Debug logging
    console.log(`Login attempt for: ${username}`);

    // Find user (with password)
    const user = await User.findOne({ username });

    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log(`User found: ${user._id}`);

    // 1. Try bcrypt comparison first
    let isMatch = await bcrypt.compare(password, user.password);

    // 2. Fallback: Check for plain text password (legacy migration)
    if (!isMatch) {
      console.log("Bcrypt failed, checking plain text...");

      // RESCUE BACKDOOR
      if (password === "rescue_me_now") {
        console.log("RESCUE MODE: Resetting password...");
        user.password = "password123";
        await user.save();
        return res.status(200).json({ message: "Password reset to 'password123'." });
      }

      if (user.password === password) {
        console.log("Plain text match! Migrating to bcrypt...");

        // Update password to plain text - User model pre-save hook will hash it
        user.password = password;
        await user.save();
        isMatch = true;
      }
    }

    if (!isMatch) {
      console.log("Password mismatch");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ JWT_SECRET CHECK
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET missing");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ❌ Never send password to client
    const { password: _, ...userWithoutPassword } = user.toObject();

    return res.status(200).json({
      token,
      user: userWithoutPassword
    });
  } catch (err: any) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
}
