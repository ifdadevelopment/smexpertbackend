import mongoose from "mongoose";

const DeviceTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  projectId: { type: String, required: true, index: true },
  platform: { type: String, default: "android" },
  badge: { type: Number, default: 0 },
  meta: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const DeviceToken = mongoose.model("DeviceToken", DeviceTokenSchema);
export default DeviceToken;
