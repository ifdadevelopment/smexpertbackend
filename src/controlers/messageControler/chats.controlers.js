import Conversation from "../../model/messageModal/conversionModal.js";
import Message from "../../model/messageModal/messageModal.js";
import formatMessages from "../../service/messageService/message.service.js";
import { getIo } from "../../socket.js";

export const sendMessage = async (req, res) => {
  try {
    const { content, senderId, receiverId } = req.body;
    const s3Files = Array.isArray(req.s3Uploads) ? req.s3Uploads : [];
    const attachments = s3Files.map((f) => f.url);

    if (!receiverId || (!content && attachments.length === 0) || !senderId) {
      return res.status(400).json({
        success: false,
        error:
          "senderId, receiverId and at least content or attachments are required",
      });
    }
    let conversation = await Conversation.findOne({
      $or: [
        { user1: senderId, user2: receiverId },
        { user1: receiverId, user2: senderId },
      ],
    });

    if (!conversation) {
      conversation = await Conversation.create({
        user1: senderId,
        user2: receiverId,
      });
    } else {
      conversation.updatedAt = new Date();
      await conversation.save();
    }

    // Create message
    let message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      receiverId,
      content: content || "",
      attachments,
    });

    // Populate for client
    message = await message.populate([
      { path: "sender", select: "name email profileImage" },
      { path: "receiverId", select: "name email profileImage" },
    ]);

    // Emit socket event
    const io = getIo();
    io.emit("receive_message", {
      conversationId: conversation._id,
      senderId,
      receiverId,
      message,
    });

    return res.status(200).json({ success: true, conversation, message });
  } catch (err) {
    console.error("sendMessage error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

export const getChats = async (req, res) => {
  try {
    const userId = req.user._id;
    const otherUserId = req.query.userId || req.params.id;

    if (!otherUserId) return res.status(400).json({ error: "userId required" });

    const conversation = await Conversation.findOne({
      $or: [
        { user1: userId, user2: otherUserId },
        { user1: otherUserId, user2: userId },
      ],
    });

    if (!conversation) return res.status(200).json([]);

    const messages = await Message.find({ conversation: conversation?._id })
      .populate([
        { path: "sender", select: "name email profileImage" },
        { path: "receiverId", select: "name email profileImage" },
      ])
      .sort({ createdAt: 1 });
    await Message.updateMany(
      { conversation: conversation._id, receiverId: userId, isRead: false },
      { $set: { isRead: true } }
    );
    messages.forEach((msg) => {
      msg.sender.profileImage = msg.sender.profileImage || null;
      msg.receiverId.profileImage = msg.receiverId.profileImage || null;
      msg.attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
    });

    const formatted = formatMessages(messages, userId);
    return res.json(formatted);
  } catch (err) {
    console.error("getChats error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
export const getUserConversation = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const conversations = await Conversation.find({
      $or: [{ user1: userId }, { user2: userId }],
    })
      .populate("user1", "name email profileImage")
      .populate("user2", "name email profileImage")
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = await Promise.all(
      conversations.map(async (chat) => {
        const otherUser =
          String(chat.user1._id) === String(userId)
            ? chat.user2
            : chat.user1;

        // ✅ get last message including attachments
        const lastMessage = await Message.findOne({
          conversation: chat._id,
        })
          .sort({ createdAt: -1 })
          .select("content attachments sender isRead createdAt")
          .populate("sender", "name email profileImage")
          .lean();

        // ✅ count unread
        const unreadCount = await Message.countDocuments({
          conversation: chat._id,
          isRead: false,
          sender: { $ne: userId },
        });

        return {
          _id: chat._id,
          otherUser,
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                attachments: Array.isArray(lastMessage.attachments)
                  ? lastMessage.attachments
                  : [],
              }
            : null,
          unreadCount,
          updatedAt: chat.updatedAt,
        };
      })
    );

    res.json(formatted.filter(Boolean));
  } catch (err) {
    console.error("getUserConversations error:", err);
    res.status(500).json({ error: "Server error" });
  }
};