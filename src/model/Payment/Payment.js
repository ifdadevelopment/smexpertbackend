// models/payment.model.js
import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    // clientId: { type: String, required: true, index: true },         
    clientName: { type: String, required: true, trim: true },
    clientPhone: { type: String, trim: true, default: null },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // name: { type: String, required: true, trim: true },           
    source: { type: String, required: true, trim: true },            
    amount: { type: Number, required: true, min: 0.01 },
    txId: { type: String, required: true, trim: true, index: true },
    method: {
      type: String,
      required: true,
      enum: ["upi", "cash", "card", "bank", "wallet"],
      lowercase: true,
      trim: true,
    },

//    groupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Group", index: true }],

    imageUrl: { type: String, default: null },

    createdByRole: { type: String, enum: ["user", "admin"], default: "user", index: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ txId: 1, userId: 1 }, { unique: false });
PaymentSchema.index({ clientName: "text", source: "text" });

export default mongoose.model("Payment", PaymentSchema);
