// controllers/group.controller.js
import User from "../../model/user.model.js";
import mongoose from "mongoose";

import {
  createGroupService,
  findGroupService,
  findGroupsService,
  addMemberToGroupService,
  removeMemberFromGroupService,
  makeAdminService,
  updateGroupDetailsService,
  deleteGroupService,
  setMemberHiddenService,
  findGroupWithDetailsService,
  sendGroupMessageService,
} from "../../service/groupMessageService/group.conversation.service.js";
import { getIo, onlineUsers } from "../../socket.js";
import GroupConversation from "../../model/groupConversation/groupConversation.model.js";
import GroupMessage from "../../model/groupConversation/groupMessage.model.js";
/*** Create a new group conversation */
export const createGroupController = async (req, res) => {
  try {
    const { name, members, branchName,branchId } = req.body;
    const adminId = req.user._id;
        const group = await createGroupService({
      name,
      members,
      admin: adminId,
      branchName,
      branchId,
    });

    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "Group name already exists!" });
    }
    return res.status(400).json({ error: "Group Name should be unique!!" });
  }
};

/*** Get a single group conversation*/
export const getGroupController = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await findGroupWithDetailsService({ _id: id });

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const formattedGroup = {
      _id: group._id,
      name: group.name,
      groupImage: group.groupImage || "",
      branch: group.branch || null,
      admin: group.admin
        ? {
            _id: group.admin._id,
            name: group.admin.name,
            email: group.admin.email,
            profileImage: group.admin.profileImage || "",
          }
        : null,
      members: group.members.map((m) => ({
        _id: m._id,
        name: m.name,
        email: m.email,
        profileImage: m.profileImage || "",
      })),
    };

    return res.status(200).json({ success: true, data: formattedGroup });
  } catch (error) {
    console.error("getGroupController error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch group details",
      error: error.message,
    });
  }
};
export const getGroupControllers = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await findGroupWithDetailsService({ _id: id });

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Fetch branch users if branch exists
    let branchUsers = [];
    if (group?.branch?._id) {
      branchUsers = await User.find({ branch: group.branch._id })
        .select("name email phone profileImage");
    }

    return res.status(200).json({
      success: true,
      group,
      branchUsers,
    });
  } catch (err) {
    console.error("getGroupController Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

/*** Get multiple groups of current user (admin or member) */
export const getGroupsController = async (req, res) => {
  try {
    const objectId = req.user._id;
    const query = { $or: [{ admin: objectId }, { members: objectId }] };
    const groups = await findGroupsService(query);
    return res.status(200).json({ success: true, data: groups });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/*** Aggregated list for chats screen (your existing pipeline) */
export const getUserGroups = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(400).json({ error: "UserId is required" });
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const groups = await GroupConversation.aggregate([
      { $match: { $or: [{ admin: userId }, { members: userId }] } },
      // LAST MESSAGE
      {
        $lookup: {
          from: "groupmessages",
          let: { groupId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$groupConversation", "$$groupId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: "users",
                localField: "sender",
                foreignField: "_id",
                as: "sender",
              },
            },
            { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                "sender._id": 1,
                "sender.name": 1,
                "sender.email": 1,
              },
            },
          ],
          as: "lastMessage",
        },
      },
      { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },
      // UNREAD COUNT for user (if you later add isRead flag)
      {
        $lookup: {
          from: "groupmessages",
          let: { groupId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$groupConversation", "$$groupId"] },
                    { $not: [{ $in: [userId, "$isReadBy"] }] },
                    { $ne: ["$sender", userId] },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          as: "unreadCount",
        },
      },
      { $addFields: { unreadCount: { $ifNull: [{ $arrayElemAt: ["$unreadCount.count", 0] }, 0] } } },
      // include admin & members basic info if needed
      { $sort: { updatedAt: -1 } },
    ]);

    return res.json(groups);
  } catch (err) {
    console.error("Error getting groups:", err);
    res.status(500).json({ error: "Server error" });
  }
};

/*** Lightweight list of group ids + names (used by profile picker) */
export const getUserGroupsController = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(400).json({ success: false, message: "User not authenticated" });

    const objectId = userId;
    const groups = await GroupConversation.find({
      $or: [{ admin: objectId }, { members: objectId }],
    })
      .select("_id name")
      .lean();

    return res.status(200).json({
      success: true,
      data: groups,
      message: groups.length ? "Groups found" : "No groups found for this user",
    });
  } catch (error) {
    console.error("Error fetching user groups:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/*** Update group details (name and/or avatar from S3) */
// controllers/group.controller.js
export const updateGroupController = async (req, res) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };

    // Handle image update
    if (req.s3Uploads?.length) {
      const avatar = req.s3Uploads.find((u) => u.field === "profileImage");
      if (avatar?.url) update.avatarUrl = avatar.url;
    }

    const updatedGroup = await updateGroupDetailsService(id, update);
    return res.status(200).json({ success: true, data: updatedGroup });
  } catch (error) {
    console.error("Error updating group:", error);
    return res.status(400).json({ success: false, message: error.message });
  }
};


/*** Add a member (admin protected in UI; service keeps data integrity) */
export const addMemberController = async (req, res) => {
  try {
    const { id } = req.params; // groupId
    const { userId } = req.body;
    const group = await addMemberToGroupService(id, userId);
    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/*** Remove a member */
export const removeMemberController = async (req, res) => {
  try {
    const { id } = req.params; // groupId
    const { userId } = req.body;
    const group = await removeMemberFromGroupService(id, userId);
    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/*** Promote to admin */
export const makeAdminController = async (req, res) => {
  try {
    const { id } = req.params; // groupId
    const { userId } = req.body;
    const group = await makeAdminService(id, userId);
    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/*** Delete group */
export const deleteGroupController = async (req, res) => {
  try {
    const { id } = req.params;
    await GroupMessage.deleteMany({ groupConversation: id });
    const result = await deleteGroupService({ _id: id });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

/*** Send message (text + files to S3) */
// export const sendGroupMessageController = async (req, res) => {
//   try {
//     const groupId = req.params.id;
//     const senderId = req.user?._id;
//     if (!senderId) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }
//     if (!mongoose.isValidObjectId(groupId)) {
//       return res.status(400).json({ success: false, message: "Invalid group id" });
//     }

//     const group = await GroupConversation.findById(groupId).lean();
//     if (!group) return res.status(404).json({ success: false, message: "Group not found" });

//     const isMember =
//       String(group.admin) === String(senderId) ||
//       (group.members || []).some((m) => String(m) === String(senderId));
//     if (!isMember) return res.status(403).json({ success: false, message: "Not a group member" });

//     const uploads = Array.isArray(req.s3Uploads) ? req.s3Uploads : [];
//     const attachments = uploads
//       .filter((u) => u && !u.error && u.url)
//       .map((u) => ({
//         url: u.url,
//         type: u.type,
//         name: u.originalName,
//         size: u.size,
//       }));

//     const content = (req.body.content || "").trim();
//     if (!content && attachments.length === 0) {
//       return res.status(400).json({ success: false, message: "Empty message" });
//     }

//     let msg = await GroupMessage.create({
//       groupConversation: groupId,
//       sender: senderId,
//       content,
//       attachments,
//       isReadBy: [senderId],
//     });
//     msg = await msg.populate({ path: "sender", select: "name email profileImage" });

//     await GroupConversation.updateOne({ _id: groupId }, { $set: { updatedAt: new Date() } });
//     try {
//       const io = getIo();
//       io.to(`group:${groupId}`).emit("group_message", { groupId, message: msg });
//       const allMembers = [...(group.members || []).map(String), String(group.admin)];
//       for (const uid of allMembers) {
//         const sid = onlineUsers.get(String(uid));
//         if (sid) io.to(sid).emit("group_message", { groupId, message: msg });
//       }
//     } catch (e) {
//       console.warn("Socket emit warning:", e?.message || e);
//     }

//     return res.status(201).json({ success: true, data: msg });
//   } catch (error) {
//     console.error("sendGroupMessage error", error);
//     return res.status(400).json({ success: false, message: error.message });
//   }
// };

/*** Delete a message (admin only) */
export const deleteGroupMessageController = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const requester = req.user?._id;
    const group = await GroupConversation.findById(id);
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });
    if (String(group.admin) !== String(requester)) {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    await GroupMessage.deleteOne({ _id: messageId, groupConversation: id });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, message: e.message });
  }
};
export const listGroupMessagesController = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user?._id;
    const limit = Math.min(parseInt(req.query.limit || "40"), 100);

    const group = await GroupConversation.findById(groupId).lean();
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });

    // Only admin/member can read
    const isMember = String(group.admin) === String(userId) || group.members.some((m) => String(m) === String(userId));
    if (!isMember) return res.status(403).json({ success: false, message: "Not a group member" });

    // Exclude hidden senders for non-admin viewers
    const senderFilter = String(group.admin) === String(userId) ? {} : { sender: { $nin: group.hiddenMembers || [] } };

    const messages = await GroupMessage.find({ groupConversation: groupId, ...senderFilter })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json({ success: true, messages });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, message: e.message });
  }
};
export const hideMemberController = async (req, res) => {
  try {
    const { id, userId } = req.params; // groupId, target user
    const { hide } = req.body;
    const requester = req.user?._id;

    const group = await GroupConversation.findById(id).lean();
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });
    if (String(group.admin) !== String(requester)) {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const updated = await setMemberHiddenService(id, userId, !!hide);
    return res.status(200).json({ success: true, data: updated });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, message: e.message });
  }
};
// "Delete for me" (soft-delete just for this viewer)
export const deleteForMeController = async (req, res) => {
  try {
    const { id, messageId } = req.params; // groupId, messageId
    const userId = req.user?._id;

    const msg = await GroupMessage.findOne({ _id: messageId, groupConversation: id });
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });

    await GroupMessage.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, message: e.message });
  }
};

// "Delete for everyone" (sender or admin)
export const deleteForEveryoneController = async (req, res) => {
  try {
    const { id, messageId } = req.params;
    const requester = req.user?._id;

    const group = await GroupConversation.findById(id).lean();
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });

    const msg = await GroupMessage.findOne({ _id: messageId, groupConversation: id }).lean();
    if (!msg) return res.status(404).json({ success: false, message: "Message not found" });

    const isAdmin = String(group.admin) === String(requester);
    const isSender = String(msg.sender) === String(requester);
    if (!isAdmin && !isSender) return res.status(403).json({ success: false, message: "Forbidden" });

    await GroupMessage.deleteOne({ _id: messageId, groupConversation: id });
    return res.json({ success: true });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ success: false, message: e.message });
  }
};
// export const getGroupMessagesController = async (req, res) => {
//   try {
//     const groupId = req.params.id;
//     const viewerId = req.user?._id;

//     if (!viewerId || !mongoose.isValidObjectId(groupId)) {
//       return res.status(400).json({ success: false, message: "Invalid request" });
//     }

//     const group = await GroupConversation.findById(groupId)
//       .select("_id admin members hiddenMembers")
//       .lean();
//     if (!group) return res.status(404).json({ success: false, message: "Group not found" });

//     const isAdmin = String(group.admin) === String(viewerId);
//     const isMember =
//       isAdmin || (group.members || []).some((m) => String(m) === String(viewerId));
//     if (!isMember) return res.status(403).json({ success: false, message: "Not a group member" });

//     const limit = Math.min(parseInt(req.query.limit || "40", 10), 100);
//     const beforeId =
//       req.query.beforeId && mongoose.isValidObjectId(req.query.beforeId)
//         ? new mongoose.Types.ObjectId(req.query.beforeId)
//         : null;

//     // Non-admin viewers do NOT see messages from hidden users (except their own)
//     const senderFilter = isAdmin
//       ? {}
//       : { $or: [{ sender: { $nin: group.hiddenMembers || [] } }, { sender: viewerId }] };

//     const query = {
//       groupConversation: groupId,
//       ...senderFilter,
//       deletedFor: { $ne: viewerId }, // respect "delete for me"
//       ...(beforeId ? { _id: { $lt: beforeId } } : {}),
//     };

//     const messages = await GroupMessage.find(query)
//       .sort({ _id: -1 })
//       .limit(limit)
//       .populate([{ path: "sender", select: "name email profileImage" }])
//       .lean();

//     const nextBeforeId = messages.length ? String(messages[messages.length - 1]._id) : null;

//     return res.status(200).json({
//       success: true,
//       messages,
//       page: { nextBeforeId },
//     });
//   } catch (e) {
//     console.error(e);
//     return res.status(400).json({ success: false, message: e.message });
//   }
// };
// In groups.controler.js or user.controler.js

/** Get users by branch */
export const getUsersByBranchControllers = async (req, res) => {
  try {
    const { branchId } = req.params; // branchId passed as URL param
    const users = await UserModel.find({ branch: branchId }).select("name email phone"); // Adjust fields as needed
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users by branch:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
//export const getGroupWithDetailsController = async (req, res) => {
//  try {
//    const { id } = req.params;
//    const group = await findGroupWithDetailsService({ _id: id });
//
//    if (!group) {
//      return res.status(404).json({ success: false, message: "Group not found" });
//    }
//
//    // ✅ fetch branch users (include profileImage, name, email)
//    let branchUsers = [];
//    if (group.branch?._id) {
//      branchUsers = await User.find({ branch: group.branch._id })
//        .select("name email phone profileImage");
//    }
//
//    return res.status(200).json({
//      success: true,
//      group,
//      branchUsers,
//    });
//  } catch (err) {
//    console.error("getGroupWithDetailsController error:", err);
//    return res.status(500).json({
//      success: false,
//      message: "Internal server error",
//      error: err.message,
//    });
//  }
//};
export const getGroupWithDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await findGroupWithDetailsService({ _id: id });

    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // ✅ fetch branch users if branch exists
    let branchUsers = [];
    if (group.branch?._id) {
      branchUsers = await User.find({ branch: group.branch._id })
        .select("name email phone profileImage");
    }

    return res.status(200).json({
      success: true,
      group: {
        _id: group._id,
        name: group.name,
        groupImage: group.groupImage || null,
        admin: group.admin,
        members: group.members,
        branch: group.branch, // now always available
      },
      branchUsers,
    });
  } catch (err) {
    console.error("getGroupWithDetailsController error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
// ✅ Update members live (toggle add/remove)
export const updateGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { membersToAdd = [], membersToRemove = [] } = req.body;

    const group = await GroupConversation.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // ✅ Remove members instantly
    if (membersToRemove.length > 0) {
      group.members = group.members.filter(
        (id) => !membersToRemove.includes(id.toString())
      );
    }

    // ✅ Add new members
    if (membersToAdd.length > 0) {
      for (const userId of membersToAdd) {
        if (!group.members.includes(userId)) {
          group.members.push(userId);
        }
      }
    }

    await group.save();

    // ✅ Fetch full user info for response
    const populatedGroup = await GroupConversation.findById(groupId)
      .populate("members", "_id name email profileImage")
      .populate("admin", "_id name email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Group members updated successfully",
      group: populatedGroup,
    });
  } catch (err) {
    console.error("Update group members error:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};
export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { senderId, content } = req.body;

    if (!groupId || !senderId)
      return res.status(400).json({ message: "Missing groupId or senderId" });

    const files = req.files || [];
    const attachments = files.map((f) => ({
      url: f.path,
      name: f.originalname,
      type: f.mimetype,
    }));

    const newMessage = await GroupMessage.create({
      groupId,
      senderId,
      content,
      attachments,
    });

    // Broadcast to group room
    const io = getIo();
    io.to(`group:${groupId}`).emit("receive_group_message", newMessage);

    res.status(201).json({ success: true, message: newMessage });
  } catch (err) {
    console.error("Group message error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const messages = await GroupMessage.find({ groupId })
      .populate("senderId", "name profileImage")
      .sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getGroupMessagesController = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await GroupMessage.find({ groupId: id })
      .populate("senderId", "name avatar email")
      .sort({ createdAt: 1 });
    res.json({ messages });
  } catch (err) {
    console.error("getGroupMessagesController error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
};

// export const sendGroupMessageController = async (req, res) => {
//   try {
//     const { id: groupId } = req.params;
//     const { senderId, content } = req.body;

//     // ✅ Extract all possible uploaded files
//     let files = [];
//     if (Array.isArray(req.files)) files = req.files;
//     else if (req.files && typeof req.files === "object") files = Object.values(req.files).flat();
//     if (Array.isArray(req.s3Uploads) && req.s3Uploads.length > 0) files = req.s3Uploads;

//     // ✅ Validation
//     if (!groupId || !senderId) {
//       return res.status(400).json({ error: "groupId and senderId are required" });
//     }
//     if (!mongoose.Types.ObjectId.isValid(groupId)) {
//       return res.status(400).json({ error: "Invalid groupId" });
//     }
//     if (!mongoose.Types.ObjectId.isValid(senderId)) {
//       return res.status(400).json({ error: "Invalid senderId" });
//     }

//     // ✅ Send message via service
//     const message = await sendGroupMessageService(groupId, senderId, content, files);

//     res.status(201).json({
//       success: true,
//       message,
//     });
//   } catch (err) {
//     console.error("sendGroupMessageController error:", err);
//     res.status(500).json({ error: err.message || "Failed to send message" });
//   }
// };
// export const getGroupMessagesController = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const messages = await GroupMessage.find({ groupConversation: id })
//       .populate("sender", "name email profileImage")
//       .sort({ createdAt: 1 });
//     res.status(200).json({ success: true, messages });
//   } catch (e) {
//     res.status(500).json({ success: false, message: e.message });
//   }
// };

export const sendGroupMessageController = async (req, res) => {
  try {
    const { id: groupId } = req.params; // from URL
    const { senderId, content } = req.body;

    if (!groupId || !senderId) {
      return res.status(400).json({ success: false, message: "Missing groupId or senderId" });
    }

    let files = [];
    if (Array.isArray(req.s3Uploads)) {
      files = req.s3Uploads.map((f) => ({
        url: f.url,
        name: f.originalName || f.name,
        type: f.type,
        size: f.size,
      }));
    } else if (Array.isArray(req.files)) {
      files = req.files.map((f) => ({
        url: f.path,
        name: f.originalname,
        type: f.mimetype,
      }));
    }

    // ✅ Save message
    const message = await GroupMessage.create({
      groupId,
      senderId,
      content,
      attachments: files,
      isReadBy: [senderId],
    });

    // ✅ Populate sender info
    const populatedMessage = await message.populate("senderId", "name profileImage");

    // ✅ Broadcast via socket.io
    const io = getIo();
    io.to(`group:${groupId}`).emit("receive_group_message", populatedMessage);

    res.status(201).json({ success: true, message: populatedMessage });
  } catch (err) {
    console.error("sendGroupMessageController error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
export const markGroupMessageReadController = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    await GroupMessage.updateMany(
      { groupId, isReadBy: { $ne: userId } },
      { $addToSet: { isReadBy: userId } }
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
export const getGroupConversationController = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const groups = await GroupConversation.aggregate([
      { $match: { members: userId } },

      // ✅ Fetch last message with sender info
      {
        $lookup: {
          from: "groupmessages",
          let: { groupId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$groupId", "$$groupId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $lookup: {
                from: "users",
                localField: "senderId",
                foreignField: "_id",
                as: "senderInfo",
              },
            },
            { $unwind: { path: "$senderInfo", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                content: 1,
                attachments: 1,
                createdAt: 1,
                "senderInfo._id": 1,
                "senderInfo.name": 1,
                "senderInfo.profileImage": 1,
              },
            },
          ],
          as: "lastMessage",
        },
      },
      { $addFields: { lastMessage: { $arrayElemAt: ["$lastMessage", 0] } } },

      // ✅ Safe unread count (guard null isReadBy)
      {
        $lookup: {
          from: "groupmessages",
          let: { groupId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$groupId", "$$groupId"] },
                    { $ne: ["$senderId", userId] },
                    {
                      $not: [
                        {
                          $in: [
                            userId,
                            {
                              $ifNull: ["$isReadBy", []], // 👈 fix: always array
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $count: "count" },
          ],
          as: "unread",
        },
      },
      {
        $addFields: {
          unreadCount: { $ifNull: [{ $arrayElemAt: ["$unread.count", 0] }, 0] },
        },
      },

      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    res.status(200).json(groups);
  } catch (err) {
    console.error("getGroupConversationController error:", err);
    res.status(500).json({ error: err.message });
  }
};

