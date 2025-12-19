import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  isFirstLogin: { type: Boolean, default: true },
  mobileNumber: { type: String },
  canEdit: { type: Boolean, default: false },
  totalDownloads: { type: Number, default: 0 },
  worksheetDownloads: { type: Number, default: 0 }
}, { timestamps: true });

// Hash password before saving (only if modified)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

export default mongoose.models.User || mongoose.model("User", userSchema);
