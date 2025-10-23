// backend/socket.js
import { Server } from "socket.io";
import GroupMessage from "./model/groupConversation/groupMessage.model.js";
import Message from "./model/messageModal/messageModal.js";

let io;
export const onlineUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    // Register user (existing)
    socket.on("register", (userId) => {
      if (!userId) return;
      onlineUsers.set(String(userId), socket.id);
      console.log("Registered user:", userId, socket.id);
    });

    // NEW: join/leave a group "room"
    socket.on("join_group", ({ groupId }) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);
    });
    socket.on("leave_group", ({ groupId }) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
    });
 socket.on("send_group_message", async (data) => {
  const message = await GroupMessage.create({
    ...data,
    isReadBy: [data.senderId], // mark sender as read
  });

  // Emit message to all group members
  io.to(`group:${data.groupId}`).emit("receive_group_message", message);
});

// When user opens group, mark all as read
socket.on("mark_group_as_read", async ({ groupId, userId }) => {
  await GroupMessage.updateMany(
    { groupId, isReadBy: { $ne: userId } },
    { $push: { isReadBy: userId } }
  );
});
// ✅ When group chat opened
socket.on("mark_group_as_read", async ({ groupId, userId }) => {
  try {
    await GroupMessage.updateMany(
      { groupId, isReadBy: { $ne: userId } },
      { $push: { isReadBy: userId } }
    );
  } catch (err) {
    console.error("mark_group_as_read error:", err);
  }
});

// ✅ When private chat opened
socket.on("mark_chat_as_read", async ({ conversationId, userId }) => {
  try {
    await Message.updateMany(
      { conversationId, isReadBy: { $ne: userId } },
      { $push: { isReadBy: userId } }
    );
  } catch (err) {
    console.error("mark_chat_as_read error:", err);
  }
});

    // Disconnect (existing)
    socket.on("disconnect", () => {
      for (const [userId, id] of onlineUsers.entries()) {
        if (id === socket.id) {
          onlineUsers.delete(userId);
          console.log("User disconnected:", userId);
          break;
        }
      }
    });
  });

  return io;
};

export const getIo = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
