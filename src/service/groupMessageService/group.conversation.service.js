import GroupConversation from "../../model/groupConversation/groupConversation.model.js";
import Branch from "../../model/branch.model.js";
import User from "../../model/user.model.js";
import GroupMessage from "../../model/groupConversation/groupMessage.model.js";
import { getIo } from "../../socket.js";
/** Create */
export const createGroupService = async (input) => {
  try {
    const group = await GroupConversation.create({
      ...input,
      branchName: input.branchName,
      branchId: input.branchId,
    });
    return group.toJSON();
  } catch (error) {
    console.error("Error creating group:", error.message);
    throw new Error("Failed to create group");
  }
};

/** Find one */
export const findGroupService = async (query) => {
  try {
    const group = await GroupConversation.findOne(query);
    return group;
  } catch (error) {
    console.error("Error finding group:", error.message);
    throw new Error("Failed to find group");
  }
};

/** Find many */
export const findGroupsService = async (query) => {
  try {
    const groups = await GroupConversation.find(query);
    return groups;
  } catch (error) {
    console.error("Error finding groups:", error.message);
    throw new Error("Failed to find groups");
  }
};

/** Update many (unused by controllers) */
export const updateGroupService = async (query, update) => {
  try {
    const result = await GroupConversation.updateMany(query, update);
    return result;
  } catch (error) {
    console.error("Error updating group:", error.message);
    throw new Error("Failed to update group");
  }
};

/** Add/Remove/MakeAdmin/UpdateDetails/Delete */
export const addMemberToGroupService = async (groupId, userId) =>
  await GroupConversation.findByIdAndUpdate(
    groupId,
    { $addToSet: { members: userId } },
    { new: true }
  );

export const removeMemberFromGroupService = async (groupId, userId) =>
  await GroupConversation.findByIdAndUpdate(
    groupId,
    { $pull: { members: userId } },
    { new: true }
  );

export const makeAdminService = async (groupId, userId) =>
  await GroupConversation.findByIdAndUpdate(
    groupId,
    { $set: { admin: userId } },
    { new: true }
  );

export const updateGroupDetailsService = async (groupId, updateData) => {
  return await GroupConversation.findByIdAndUpdate(
    groupId,
    { $set: updateData },
    { new: true, runValidators: true }
  );
};

export const deleteGroupService = async (query) => {
  try {
    const result = await GroupConversation.deleteMany(query);
    return result;
  } catch (error) {
    console.error("Error deleting group:", error.message);
    throw new Error("Failed to delete group");
  }
};
export const setMemberHiddenService = async (groupId, userId, hide) => {
  const update = hide
    ? { $addToSet: { hiddenMembers: userId } }
    : { $pull: { hiddenMembers: userId } };
  return GroupConversation.findByIdAndUpdate(groupId, update, { new: true });
};

//export const findGroupWithDetailsService = async (filter) => {
//  try {
//    const group = await GroupConversation.findOne(filter)
//      .populate({
//        path: "admin",
//        select: "name email phone profileImage",
//      })
//      .populate({
//        path: "members",
//        select: "name email phone profileImage",
//      })
//      .populate({
//        path: "branch",
//        select: "name location _id", // optional fields
//      })
//      .lean(); // make plain JS object
//
//    if (!group) return null;
//
//    return group;
//  } catch (error) {
//    console.error("findGroupWithDetailsService error:", error);
//    throw new Error("Failed to find group with details");
//  }
//};

export const findGroupWithDetailsService = async (filter) => {
  try {
    const group = await GroupConversation.findOne(filter)
      .populate({
        path: "admin",
        model: "User",
        select: "name email phone profileImage",
      })
      .populate({
        path: "members",
        model: "User",
        select: "name email phone profileImage",
      })
      .lean();

    if (!group) return null;

    // ✅ manually fetch branch details
    if (group.branchId) {
      const branch = await Branch.findById(group.branchId).select("name location _id");
      group.branch = branch || { _id: group.branchId, name: group.branchName || "N/A" };
    }

    return group;
  } catch (error) {
    console.error("findGroupWithDetailsService error:", error.message);
    throw new Error("Failed to find group with details");
  }
};

export const sendGroupMessageService = async (groupId, senderId, content, files = []) => {
  if (!groupId || !senderId) throw new Error("groupId and senderId are required");

  const group = await GroupConversation.findById(groupId).populate("members");
  if (!group) throw new Error("Group not found");

  const attachments = Array.isArray(files)
    ? files
        .filter((f) => f && f.url)
        .map((f) => ({
          url: f.url,
          name: f.originalname || f.originalName || "unknown",
          type: f.mimetype || f.type || "unknown",
          size: f.size || 0,
        }))
    : [];

  // ✅ Create message in DB
  const message = await GroupMessage.create({
    groupId,
    senderId,
    content: content?.trim() || "",
    attachments,
  });

  // ✅ Broadcast to all connected sockets in group
  const io = getIo();
  io.to(`group:${groupId}`).emit("receive_group_message", {
    _id: message._id,
    groupId,
    senderId,
    content: message.content,
    attachments,
    createdAt: message.createdAt,
  });

  return message;
};
