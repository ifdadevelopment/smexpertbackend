// model/branch.model.js
import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    code: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    isActive: { type: Boolean, default: true },

  },
  { timestamps: true }
);

const BranchModel = mongoose.model("Branch", BranchSchema);
export default BranchModel;
