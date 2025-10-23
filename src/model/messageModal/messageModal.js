import mongoose from "mongoose";

const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    attachments: [{ type: String, default: null }],
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Validation before saving
MessageSchema.pre("save", async function (next) {
  const Conversation = mongoose.model("Conversation");
  const convo = await Conversation.findById(this.conversation);

  if (!convo) return next(new Error("Conversation not found."));

  const senderId = this.sender.toString();
  if (
    senderId !== convo.user1.toString() &&
    senderId !== convo.user2.toString()
  ) {
    return next(new Error("Sender must be a participant in the conversation."));
  }

  if (!this.content && (!this.attachments || this.attachments.length === 0)) {
    return next(new Error("Message must contain text or a file."));
  }

  next();
});

const Message = mongoose.model("Message", MessageSchema);
export default Message;
