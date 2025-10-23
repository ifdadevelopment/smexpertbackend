import mongoose from "mongoose";
const { Schema } = mongoose;

const GroupConversationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchName: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    groupImage: { type: String, default: "" },
    active: { type: Boolean, default: false },
  },
  { timestamps: true }
);

GroupConversationSchema.pre("save", function (next) {
  if (!this.members || this.members.length < 2) {
    return next(new Error("A group must have at least 2 members."));
  }
  next();
});

const GroupConversation = mongoose.model(
  "GroupConversation",
  GroupConversationSchema
);

export default GroupConversation;
