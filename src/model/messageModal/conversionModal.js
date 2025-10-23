import mongoose from "mongoose";
const { Schema } = mongoose;

// Conversation Schema (exactly 2 users)
const ConversationSchema = new Schema(
  {
    user1: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    user2: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent creating a conversation where both users are the same
ConversationSchema.pre("save", function (next) {
  if (this.user1.toString() === this.user2.toString()) {
    return next(new Error("A conversation must be between two different users."));
  }
  next();
});

const Conversation = mongoose.model("Conversation", ConversationSchema);

export default Conversation;
