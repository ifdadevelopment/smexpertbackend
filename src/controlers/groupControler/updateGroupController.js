import dotenv from 'dotenv';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import GroupConversation from '../../model/groupConversation/groupConversation.model.js';
import { updateGroupDetailsService } from '../../service/groupMessageService/group.conversation.service.js';

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

// Helper function to extract the S3 key from a URL
const keyFromUrl = (url) => {
  try {
    if (!url) return null;
    const u = new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
};

export const updateGroupControllers = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user?._id;

    // 1️⃣ Find the group to update
    const group = await GroupConversation.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Only admin can update the group
    if (group.admin.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only admin can update group" });
    }

    // 2️⃣ Prepare the update data
    const updateData = {};
    const body = req.body || {};

    // ✅ Update group name if provided
    if (body.name || body.groupName) {
      const newName = (body.name || body.groupName).trim();
      if (newName.length < 2)
        return res.status(400).json({ error: "Group name too short" });
      updateData.name = newName;
    }

    // ✅ Handle image upload via middleware (only saving URL)
    const uploadedFile = Array.isArray(req.s3Uploads)
      ? req.s3Uploads.find((f) => f.field === "groupImage")
      : null;

    if (uploadedFile && uploadedFile.url) {
      updateData.groupImage = uploadedFile.url;

      // Delete old image from S3 if exists
      const oldKey = group.groupImage && keyFromUrl(group.groupImage);
      if (oldKey && oldKey !== uploadedFile.key && BUCKET) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey }));
          console.log(`🗑️ Deleted old image from S3: ${oldKey}`);
        } catch (err) {
          console.warn("⚠️ Failed to delete old S3 image:", err.message);
        }
      }
    }

    // If no updates, return an error
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No update data provided" });
    }

    // 3️⃣ Update group in MongoDB (Save only group name and group image URL)
    const updatedGroup = await updateGroupDetailsService(groupId, updateData);

    // 4️⃣ Return success response with updated group info
    return res.status(200).json({
      success: true,
      message: "Group updated successfully",
      group: {
        _id: updatedGroup._id,
        name: updatedGroup.name,
        groupImage: updatedGroup.groupImage,
        members: updatedGroup.members,
        admin: updatedGroup.admin,
        branchName: updatedGroup.branchName,
        branchId: updatedGroup.branchId,
        active: updatedGroup.active,
        updatedAt: updatedGroup.updatedAt,
      },
    });
  } catch (error) {
    console.error("❌ Group update error:", error);
    return res.status(500).json({
      error: "Group update failed",
      details: error.message,
    });
  }
};
