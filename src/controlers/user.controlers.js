// controlers/user.controlers.js
import { updateSessionService } from "../service/session.service.js";
import {
  createUserService,
  findAllUserService,
  findUserService,
  updateUserService,
  findUsersByBranchService,
} from "../service/user.service.js";
import BranchModel from "../model/branch.model.js";

// POST /register  (branchId OR branchName supported)
const normalizeStr = (v) => (typeof v === "string" ? v.trim() : "");
const toId = (v) =>
  v && typeof v === "object" && typeof v.$oid === "string" ? v.$oid : String(v || "");

export const userRegisterControler = async (req, res) => {
  try {
    const {
      email,
      branchId: rawBranchId,
      branchName: rawBranchName,
      ...rest
    } = req.body || {};

    const emailTrim = normalizeStr(email);
    if (!emailTrim) return res.status(400).json({ error: "Email is required" });

    const existUser = await findUserService({ email: emailTrim });
    if (existUser) return res.status(400).json({ error: "Email Already Exist" });

    // --- Resolve/ensure branch → { id, name } ---
    let branchId = normalizeStr(toId(rawBranchId));
    let branchName = normalizeStr(rawBranchName);

    let branchDoc = null;

    if (branchId) {
      // Validate provided branchId
      branchDoc = await BranchModel.findOne({ _id: branchId, isActive: true })
        .select({ _id: 1, name: 1 })
        .lean();

      if (!branchDoc) {
        return res.status(400).json({ error: "Invalid or inactive branch" });
      }

      // prefer DB canonical name
      branchName = branchDoc.name || branchName;
    } else {
      // No branchId; need a name to create or find
      if (!branchName) {
        return res.status(400).json({ error: "Branch ID or Branch Name is required" });
      }

      // Try to find by case-insensitive name; if not found, create active branch
      branchDoc = await BranchModel
        .findOne({ name: new RegExp(`^${branchName}$`, "i"), isActive: true })
        .select({ _id: 1, name: 1 })
        .lean();

      if (!branchDoc) {
        const created = await BranchModel.create({
          name: branchName,
          isActive: true,
        });
        branchDoc = { _id: created._id, name: created.name };
      }
      branchId = String(branchDoc._id);
      branchName = branchDoc.name || branchName;
    }

    // Build normalized payload: force embedded branch, strip branchId/branchName
    const payload = {
      ...rest,
      email: emailTrim,
      branch: { id: String(branchId), name: String(branchName || "") },
    };

    const user = await createUserService(payload);

    // Optional: return a clean projection
    return res.status(200).json({
      message: "register successfully",
      user: {
        _id: String(user._id),
        name: user.name || "",
        email: user.email || "",
        user_type: user.user_type || "user",
        branch: {
          id: String(user?.branch?.id || branchId),
          name: String(user?.branch?.name || branchName || ""),
        },
        active: !!user.active,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Cannot Register at this time" });
  }
};

// GET /users (admin)  — unchanged
const userManagementController = async (req, res) => {
  try {
    const users = await findAllUserService({});
    users.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return res.status(200).json(users);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PUT /users/:id (admin)  — unchanged
export const updateUserController = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.user_type !== "admin") {
      return res.status(403).json({ error: "Forbidden: Admins only" });
    }
    if (!id) return res.status(400).json({ error: "User ID is required" });
    if (id === String(req.user._id)) {
      return res.status(400).json({ error: "You cannot update your own profile" });
    }
    const updatedUser = await updateUserService(id, req.body);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    await updateSessionService({ user: id }, { valid: false });
    return res.status(200).json({ message: "User updated successfully" });
  } catch (err) {
    console.error("Error in updateUserController:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

// USER scope: GET /users/by-branch  — already existed
// controllers/user.controlers.js  (replace this function)
// controllers/user.controlers.js
export const getUsersByBranchController = async (req, res) => {
  try {
    const isAdmin = req.user?.user_type === "admin";

    const normalizeBranch = (b) => {
      if (!b) return { id: null, name: "" };
      if (typeof b === "string") return { id: b, name: "" };
      const id = b.id ?? b._id ?? b.branchId ?? null;
      const name = b.name ?? b.branchName ?? "";
      return { id, name };
    };

    let targetBranch = normalizeBranch(req.user?.branch);

    const { branchId, branchName } = req.query || {};
    if (isAdmin && (branchId || branchName)) {
      const where = branchId
        ? { _id: branchId, isActive: true }
        : { name: branchName, isActive: true };
      const branchDoc = await BranchModel
        .findOne(where)
        .select({ _id: 1, name: 1 })
        .lean();

      if (!branchDoc) return res.status(404).json({ error: "Branch not found or inactive" });
      targetBranch = { id: String(branchDoc._id), name: branchDoc.name || "" };
    }

    if (!targetBranch?.id) return res.status(400).json({ error: "User branch not found" });

    const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);
    const skip = Math.max(parseInt(req.query.skip || "0", 10), 0);
    const search = (req.query.search || "").trim();

    const users = await findUsersByBranchService({
      id: targetBranch.id,
      limit,
      skip,
      search,
    });

    const list = (users || [])
      .map((u) => ({
        _id: String(u._id),
        name: u.name || "",
        email: u.email || "",
        user_type: u.user_type || "user",
        branchId: u?.branch?.id ? String(u.branch.id) : "",
        branchName: u?.branch?.name || "",
        profileImage: u.profileImage || "",
        profession: u.profession || "",
        active: !!u.active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json({
      success: true,
      branchId: String(targetBranch.id),
      branchName: targetBranch.name || "",
      count: list.length,
      limit,
      skip,
      users: list,
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};




// ADMIN: GET /admin/branches  — list all active branches
export const adminListAllBranchesController = async (_req, res) => {
  try {
    const branches = await BranchModel.find({ isActive: true })
      .select({ name: 1, code: 1 })
      .sort({ name: 1 })
      .lean();
    return res.status(200).json(branches);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};

// ADMIN: GET /admin/branches/:branchId/users  — users in selected branch
export const adminGetUsersByBranchIdController = async (req, res) => {
  try {
    const { branchId } = req.params;
    if (!branchId) return res.status(400).json({ error: "branchId is required" });
    const branch = await BranchModel.findOne({ _id: branchId, isActive: true }).lean();
    if (!branch) return res.status(404).json({ error: "Branch not found or inactive" });

    const users = await findUsersByBranchService({ id: branch._id });
    return res.status(200).json({ success: true, branch: { id: branch._id, name: branch.name }, users });
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};

// (optional) POST /branches (admin) — add new branch directly
export const createBranchController = async (req, res) => {
  try {
    const { name, code } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "Branch name is required" });

    const existing = await BranchModel.findOne({
      $or: [{ name: name.trim() }, ...(code ? [{ code: code.trim().toUpperCase() }] : [])],
    });
    if (existing) return res.status(409).json({ error: "Branch already exists" });

    const branch = await BranchModel.create({
      name: name.trim(),
      code: code?.trim()?.toUpperCase(),
      isActive: true,
    });
    return res.status(201).json(branch);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
};

export {
  userManagementController,
};
export default userRegisterControler;
