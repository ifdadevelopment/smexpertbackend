// user.service.js
import lodash from "lodash";
import UserModel from "../model/user.model.js";
import BranchModel from "../model/branch.model.js";

const { omit } = lodash;

export async function createUserService(user_data) {
  try {
    // 1) Unique email
    const existingUser = await UserModel.findOne({ email: user_data?.email });
    if (existingUser) throw new Error("This email already Exist");

    // 2) Resolve branch (NEW: accept embedded branch)
    let branchDoc = null;

    // a) If controller already embedded branch {id, name}, just verify and use it
    if (user_data.branch?.id) {
      branchDoc = await BranchModel.findOne({ _id: user_data.branch.id, isActive: true })
        .select({ _id: 1, name: 1 })
        .lean();
      if (!branchDoc) throw new Error("Invalid or inactive branch");
    } else {
      // b) Backward compat: resolve from branchId / branchName (+ optional code)
      if (user_data.branchId) {
        branchDoc = await BranchModel.findOne({ _id: user_data.branchId, isActive: true }).lean();
        if (!branchDoc) throw new Error("Invalid or inactive branch");
      } else if (user_data.branchName) {
        branchDoc = await BranchModel.findOne({
          $or: [
            { name: user_data.branchName.trim() },
            ...(user_data.branchCode ? [{ code: user_data.branchCode.trim().toUpperCase() }] : []),
          ],
          isActive: true,
        }).lean();

        if (!branchDoc) {
          const newBranch = await BranchModel.create({
            name: user_data.branchName.trim(),
            code: user_data.branchCode?.trim()?.toUpperCase(),
            isActive: true,
          });
          branchDoc = newBranch.toObject();
        }
      } else {
        throw new Error("Branch is required");
      }
    }

    // 3) Build user payload (model expects embedded branch id+name)
    const new_user_data = {
      email: user_data.email,
      password: user_data.password,
      name: user_data.name,
      branch: { id: branchDoc._id, name: branchDoc.name }, // ✅ embed id + name
      user_type: user_data.user_type || "user",
      profession: user_data.profession || "",
      profileImage: user_data.profileImage || "",
      active: true,
    };

    const user = await UserModel.create(new_user_data);
    const u = user.toJSON ? omit(user.toJSON(), "password") : user;
    return u;
  } catch (error) {
    throw new Error(error?.message || "Create Service Error");
  }
}
export async function validatePasswordLoginService({ email, password }) {
  const user = await UserModel.findOne({ email, active: true });
  if (!user) return false;
  const isValid = await user.comparePassword(password);
  if (!isValid) return false;
  return user.toJSON ? omit(user.toJSON(), "password") : user;
}

export async function findUserService(query) {
  try {
    const user = await UserModel.findOne(query).lean();
    if (!user) return false;
    return user;
  } catch {
    return false;
  }
}

export async function findAllUserService(query) {
  try {
    const users = await UserModel.find(query).lean();
    return users || [];
  } catch {
    return [];
  }
}

// Update user service
export const updateUserService = async (id, updateData) => {
  try {
    // if branchId provided on update, convert to embedded structure
    if (updateData.branchId) {
      const branchDoc = await BranchModel.findOne({
        _id: updateData.branchId,
        isActive: true,
      }).lean();
      if (!branchDoc) throw new Error("Invalid or inactive branch");
      updateData.branch = { id: branchDoc._id, name: branchDoc.name };
      delete updateData.branchId;
    }
    const updatedUser = await UserModel.updateOne({ _id: id }, updateData);
    return updatedUser;
  } catch (err) {
    console.log(err);
    return false;
  }
};

// service/user.service.js
export const findUsersByBranchService = async (opts = {}) => {
  const { id, search = "", limit = 30, skip = 0 } = opts;

  const q = id ? { "branch.id": id } : {};
  if (search) {
    q.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  return await UserModel.find(q)
    .select({ name: 1, email: 1, user_type: 1, branch: 1, profileImage: 1, profession: 1, active: 1 })
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

