import { Server } from "socket.io";
import GroupMessage from "./model/groupConversation/groupMessage.model.js";
import Message from "./model/messageModal/messageModal.js";
import User from "./model/user.model.js";

let io;
export const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, { cors: { origin: "*" } });

  io.on("connection", (socket) => {

    // ✅ USER ONLINE
    socket.on("register", async (userId) => {
      if (!userId) return;
      onlineUsers.set(String(userId), socket.id);

      await User.findByIdAndUpdate(userId, { online: true });

      io.emit("update_user_status", {
        userId,
        online: true,
      });
    });

    // ✅ JOIN GROUP
    socket.on("join_group", ({ groupId }) => {
      if (groupId) socket.join(`group:${groupId}`);
    });

    // ✅ SEND GROUP MESSAGE
    socket.on("send_group_message", async (data) => {
      try {
        const { groupId, senderId, message } = data;

        if (!groupId || !senderId || !message) {
          return socket.emit("group_message_error", {
            message: "senderId, groupId and message are required!",
          });
        }

        const newMessage = await GroupMessage.create({
          groupId,
          senderId,
          message,
          isReadBy: [senderId],
        });

        io.to(`group:${groupId}`).emit("receive_group_message", newMessage);
      } catch (err) {
        socket.emit("group_message_error", { message: err.message });
      }
    });

    // ✅ MARK GROUP READ
    socket.on("mark_group_as_read", async ({ groupId, userId }) => {
      await GroupMessage.updateMany(
        { groupId, isReadBy: { $ne: userId } },
        { $push: { isReadBy: userId } }
      );
    });

    // ✅ PRIVATE CHAT READ
    socket.on("mark_chat_as_read", async ({ conversationId, userId }) => {
      await Message.updateMany(
        { conversationId, isReadBy: { $ne: userId } },
        { $push: { isReadBy: userId } }
      );
    });

    // ✅ PRIVATE + GROUP TYPING
    socket.on("typing", ({ peerId, groupId, userId }) => {
      if (peerId) {
        const receiverSocket = onlineUsers.get(String(peerId));
        if (receiverSocket) {
          io.to(receiverSocket).emit("user_typing", { userId });
        }
      }
      if (groupId) {
        socket.to(`group:${groupId}`).emit("user_typing", { userId, groupId });
      }
    });

    socket.on("stop_typing", ({ peerId, groupId, userId }) => {
      if (peerId) {
        const receiverSocket = onlineUsers.get(String(peerId));
        if (receiverSocket) {
          io.to(receiverSocket).emit("user_stop_typing", { userId });
        }
      }
      if (groupId) {
        socket.to(`group:${groupId}`).emit("user_stop_typing", { userId, groupId });
      }
    });

    // ✅ MESSAGE DELIVERED (ONLY TO TARGET USER)
    socket.on("message_delivered", async ({ messageId, to }) => {
      await Message.findByIdAndUpdate(messageId, { delivered: true });
      const targetSocket = onlineUsers.get(String(to));
      if (targetSocket) {
        io.to(targetSocket).emit("message_status_update", {
          messageId,
          delivered: true,
        });
      }
    });

    // ✅ MESSAGE READ (ONLY TO TARGET USER)
    socket.on("message_read", async ({ messageId, to }) => {
      await Message.findByIdAndUpdate(messageId, { read: true });
      const targetSocket = onlineUsers.get(String(to));
      if (targetSocket) {
        io.to(targetSocket).emit("message_status_update", {
          messageId,
          read: true,
        });
      }
    });

    // ✅ USER OFFLINE + LAST SEEN FIXED
    socket.on("disconnect", async () => {
      for (const [userId, sockId] of onlineUsers.entries()) {
        if (sockId === socket.id) {
          onlineUsers.delete(userId);

          await User.findByIdAndUpdate(userId, {
            online: false,
            lastSeen: new Date(),
          });

          io.emit("update_user_status", {
            userId,
            online: false,
            lastSeen: new Date(),
          });
          break;
        }
      }
    });

  });

  return io;
};

export const getIo = () => {
  if (!io) throw new Error("Socket not initialized");
  return io;
};
