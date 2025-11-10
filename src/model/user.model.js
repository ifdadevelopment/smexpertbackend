// user.model.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    user_type: { type: String, default: "user", enum: ["user", "admin"] },
    name: { type: String, required: true },

    // ⬇️ changed from String to embedded object with id + name
    branch: {
      id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: { type: String, required: true },
    },

    active: { type: Boolean, default: false },
    profileImage: { type: String, default: "" },
    profession: { type: String, default: "" },
    resetOtp: { type: String, default: null },
    otpExpiry: { type: Number, default: null },
    online: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const UserModel = mongoose.model("User", UserSchema);
export default UserModel;
