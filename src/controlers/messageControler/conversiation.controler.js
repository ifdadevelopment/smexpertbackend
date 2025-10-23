import Conversation from "../../model/messageModal/conversionModal.js";
import Message from "../../model/messageModal/messageModal.js";

// Get all conversations for a user
// export const getUserConversations = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     if (!userId) {
//       return res.status(400).json({ error: "UserId is required" });
//     }

//     const conversations = await Conversation.find({
//       $or: [{ user1: userId }, { user2: userId }],
//     })
//       .populate("user1", "name email profileImage") // <-- include profileImage
//       .populate("user2", "name email profileImage") // <-- include profileImage
//       .sort({ updatedAt: -1 });

//     // Build formatted data with last message + unread count
//     const formatted = await Promise.all(
//       conversations.map(async (convo) => {
//         const otherUser =
//           convo.user1._id.toString() === userId.toString()
//             ? convo.user2
//             : convo.user1;

//         // 1. Get last message
//         const lastMessage = await Message.findOne({ conversation: convo._id })
//           .sort({ createdAt: -1 })
//           .select("content sender createdAt isRead")
//           .populate("sender", "name email profileImage"); // include sender's profileImage

//         // 2. Count unread messages (not read & not sent by me)
//         const unreadCount = await Message.countDocuments({
//           conversation: convo._id,
//           isRead: false,
//           sender: { $ne: userId },
//         });

//         return {
//           _id: convo._id,
//           otherUser,
//           lastMessage: lastMessage
//             ? {
//                 content: lastMessage.content,
//                 sender: lastMessage.sender,
//                 createdAt: lastMessage.createdAt,
//                 isRead: lastMessage.isRead,
//               }
//             : null,
//           unreadCount,
//           lastUpdated: convo.updatedAt,
//           createdAt: convo.createdAt,
//         };
//       })
//     );

//     return res.json(formatted);
//   } catch (err) {
//     console.error("Error getting conversations:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };
export const getUserConversations = async (req, res) => {
  try {
    const userId = req?.user?._id;
    if (!userId) {
      // Auth not attached or invalid token
      return res.status(401).json({ error: "Unauthorized: missing user" });
    }

    // Exclude corrupted conversations where either side is null
    const conversations = await Conversation.find({
      $and: [
        { $or: [{ user1: userId }, { user2: userId }] },
        { user1: { $ne: null } },
        { user2: { $ne: null } },
      ],
    })
      .populate("user1", "name email profileImage")
      .populate("user2", "name email profileImage")
      .sort({ updatedAt: -1 })
      .exec();

    // Soft-guard: also filter out any that still came back null after populate
    const saneConversations = conversations.filter(
      (c) => c?.user1 && c?.user2 && c?._id
    );

    const formatted = await Promise.all(
      saneConversations.map(async (convo) => {
        // If for any reason these are missing, skip this convo
        const u1 = convo?.user1;
        const u2 = convo?.user2;
        if (!u1 || !u2) return null;

        const isUser1 = String(u1._id) === String(userId);
        const otherUser = isUser1 ? u2 : u1;

        // Defensive: if still no other user, skip
        if (!otherUser?._id) return null;

        // 1) Last message (guarded)
        let lastMessage = await Message.findOne({ conversation: convo._id })
          .sort({ createdAt: -1 })
          .select("content sender createdAt isRead")
          .populate("sender", "name email profileImage")
          .exec();

        if (lastMessage) {
          lastMessage = {
            content: lastMessage.content ?? "",
            sender: lastMessage.sender ?? null,
            createdAt: lastMessage.createdAt ?? null,
            isRead: !!lastMessage.isRead,
          };
        } else {
          lastMessage = null;
        }

        // 2) Unread count (not read & not sent by me)
        const unreadCount = await Message.countDocuments({
          conversation: convo._id,
          isRead: false,
          sender: { $ne: userId },
        }).exec();

        return {
          _id: convo._id,
          otherUser, // { _id, name, email, profileImage }
          lastMessage,
          unreadCount,
          lastUpdated: convo.updatedAt ?? convo.createdAt ?? null,
          createdAt: convo.createdAt ?? null,
        };
      })
    );

    // Remove any nulls from skipped/invalid convos
    const safeOutput = formatted.filter(Boolean);

    return res.json(safeOutput);
  } catch (err) {
    console.error("Error getting conversations:", err);
    return res.status(500).json({ error: "Server error" });
  }
};