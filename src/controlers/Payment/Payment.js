// src/controlers/Payment/Payment.js
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import Payment from "../../model/Payment/Payment.js";

// -------------------- config / helpers --------------------
const isObjId = (v) => mongoose.isValidObjectId(v);
const allowedMethods = new Set(["upi", "cash", "card", "bank", "wallet"]);

const coerceAmount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const toObjectIdArray = (val) => {
  const arr = Array.isArray(val) ? val : val ? [val] : [];
  return arr.filter(isObjId).map((x) => new mongoose.Types.ObjectId(String(x)));
};

const keyFromUrl = (url = "") => {
  try {
    const u = new URL(url);
    // for both S3 and CloudFront URLs, pathname (without leading slash) is the key
    return u.pathname.replace(/^\/+/, "");
  } catch {
    return null;
  }
};

const isAdmin = (req) => req.user?.user_type === "admin";

const S3_REGION = process.env.AWS_REGION;
const S3_BUCKET = process.env.S3_BUCKET;
const s3 = new S3Client({ region: S3_REGION });

// Resolve uploads regardless of middleware shape (array vs map)
const findUpload = (req, fieldName) => {
  if (Array.isArray(req.s3Uploads)) {
    return req.s3Uploads.find((u) => u.field === fieldName) || null;
  }
  if (req.s3Uploads && typeof req.s3Uploads === "object") {
    const v = req.s3Uploads[fieldName];
    if (!v) return null;
    // could be {url, key} or [{url, key}]
    return Array.isArray(v) ? v[0] : v;
  }
  return null;
};

// -------------------- controllers --------------------

// POST /payments
export const createPayment = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const {
      clientName,
      clientPhone,
      name,
      source,
      amount,
      txId,
      method,
    } = req.body;

    const amt = coerceAmount(amount);
    if (!amt) return res.status(400).json({ success: false, message: "Invalid amount" });

    const m = String(method || "").toLowerCase().trim();
    if (!allowedMethods.has(m)) {
      return res.status(400).json({ success: false, message: "Invalid method" });
    }

    // Accept groupIds or groupIds[]
//    const rawGroups = req.body["groupIds[]"] ?? req.body.groupIds;
//    const groupIds = toObjectIdArray(rawGroups);

    // Require payment image uploaded via extractS3Uploads
    const uploaded = findUpload(req, "paymentImage");
    if (!uploaded?.url) {
      return res.status(400).json({ success: false, message: "Payment image is required" });
    }

    const doc = await Payment.create({
      // note: adapt these fields to your exact schema; below matches your prior usage
      clientName: clientName ? String(clientName).trim() : undefined,
      clientPhone: clientPhone ? String(clientPhone).trim() : undefined,
      userId, // if your schema uses createdBy, rename here and in model
      name: name ? String(name).trim() : undefined,
      source: source ? String(source).trim() : undefined,
      amount: amt,
      txId: txId ? String(txId).trim() : undefined,
      method: m,
//      groupIds,
      imageUrl: uploaded.url, 
      createdByRole: isAdmin(req) ? "admin" : "user",
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("createPayment error:", err);
    return res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};

// GET /payments (admin → all; user → own)
export const listPayments = async (req, res) => {
  try {
    const isAdminUser = isAdmin(req);
    const filter = isAdminUser ? {} : { userId: req.user._id };

    // Optional filters
    const { method, from, to } = req.query;

    if (method && allowedMethods.has(String(method).toLowerCase())) {
      filter.method = String(method).toLowerCase();
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const docs = await Payment.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: docs });
  } catch (err) {
    console.error("listPayments error:", err);
    return res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};

// (Optional) GET /payments/me – always own
export const listMyPayments = async (req, res) => {
  try {
    const docs = await Payment.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: docs });
  } catch (err) {
    console.error("listMyPayments error:", err);
    return res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};

// GET /payments/:id
export const getPayment = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = req.params.id;
    if (!isObjId(id)) {
      return res.status(400).json({ success: false, message: "Invalid payment id" });
    }

    const doc = await Payment.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    if (!isAdmin(req) && String(doc.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error("getPayment error:", err);
    return res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};

// PUT /payments/:id  (admin only)
export const adminUpdatePayment = async (req, res) => {
  try {
    if (!isAdmin(req))
      return res.status(403).json({ success: false, message: "Admin only" });

    const id = req.params.id;
    if (!isObjId(id))
      return res.status(400).json({ success: false, message: "Invalid payment id" });

    const current = await Payment.findById(id);
    if (!current)
      return res.status(404).json({ success: false, message: "Payment not found" });

    const body = req.body;
    const update = {
      clientName: body.clientName?.trim(),
      clientPhone: body.clientPhone?.trim(),
      name: body.name?.trim(),
      source: body.source?.trim(),
      txId: body.txId?.trim(),
    };

    // ✅ Validate & update payment method
    if (body.method) {
      const m = String(body.method).toLowerCase().trim();
      if (!allowedMethods.has(m)) {
        return res.status(400).json({ success: false, message: "Invalid method" });
      }
      update.method = m;
    }

    // ✅ Validate & update amount
    if (body.amount !== undefined) {
      const amt = coerceAmount(body.amount);
      if (!amt)
        return res.status(400).json({ success: false, message: "Invalid amount" });
      update.amount = amt;
    }

    // ✅ Group cleanup (kept compatible)
    const rawGroups = body["groupIds[]"] ?? body.groupIds;
    if (rawGroups !== undefined) {
      update.groupIds = toObjectIdArray(rawGroups);
    }

    // ✅ Handle new image upload
    const uploaded = findUpload(req, "paymentImage");
    if (uploaded?.url) {
      const oldImageKey = keyFromUrl(current.imageUrl);
      update.imageUrl = uploaded.url;

      // Update payment first — to ensure data integrity
      const saved = await Payment.findByIdAndUpdate(id, update, { new: true }).lean();

      // Try deleting the old image (best effort)
      if (oldImageKey && S3_BUCKET) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: oldImageKey }));
          console.log(`🧹 Old image deleted: ${oldImageKey}`);
        } catch (e) {
          console.warn("⚠️ Failed to delete old S3 image:", e?.message || e);
        }
      }

      return res.json({ success: true, data: saved });
    }

    // ✅ If no new image uploaded, just update other fields
    const saved = await Payment.findByIdAndUpdate(id, update, { new: true }).lean();
    return res.json({ success: true, data: saved });

  } catch (err) {
    console.error("❌ adminUpdatePayment error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      details: err.message,
    });
  }
};

// DELETE /payments/:id  (user → own; admin → any)
export const deletePayment = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = req.params.id;
    if (!isObjId(id)) {
      return res.status(400).json({ success: false, message: "Invalid payment id" });
    }

    const doc = await Payment.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    if (!isAdmin(req) && String(doc.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Delete DB doc first
    await doc.deleteOne();

    // Best-effort delete image
    const key = keyFromUrl(doc.imageUrl);
    if (key && S3_BUCKET) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
      } catch (e) {
        console.warn("S3 delete failed:", e?.message || e);
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("deletePayment error:", err);
    return res.status(500).json({ success: false, message: "Server error", details: err.message });
  }
};
