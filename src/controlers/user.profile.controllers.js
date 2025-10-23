import dotenv from "dotenv";
dotenv.config();

import UserModel from "../model/user.model.js";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;
const keyFromUrl = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
};

export const updateProfileController = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = {};

    if (req.body.profession) {
      updateData.profession = String(req.body.profession).trim();
    }
    const newUpload = Array.isArray(req.s3Uploads)
      ? req.s3Uploads.find((u) => u.field === "profileImage")
      : null;

    if (newUpload) {
      updateData.profileImage = newUpload.url;
      const currentUser = await UserModel.findById(userId).lean();
      const oldUrl = currentUser?.profileImage;
      const oldKey = currentUser?.profileImageKey || keyFromUrl(oldUrl);

      if (oldKey && BUCKET) {
        try {
          await s3.send(
            new DeleteObjectCommand({ Bucket: BUCKET, Key: oldKey })
          );
        } catch (e) {
          console.warn("⚠️ Could not delete old profile image:", e?.message);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No data provided to update" });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password");

    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Profile update error:", err);
    return res.status(500).json({
      error: "Profile update failed",
      details: err.message,
    });
  }
};
