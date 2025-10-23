import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    name: { type: String },
    type: { type: String },
    size: { type: Number },
  },
  { _id: false }
);

const groupMessageSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupConversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
     isRead: {
      type: Boolean,
      default: false,
    },
    isReadBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("GroupMessage", groupMessageSchema);
