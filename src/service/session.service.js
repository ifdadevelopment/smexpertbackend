import SessionModel from "../model/session.model.js";
import { decodeTokenByJwt, generateTokenByJwt } from "../utils/utils.jwt.js";
import lodash from "lodash";
import { findUserService } from "./user.service.js";

const { get } = lodash;

export const createSessionService = async (userId) => {
  try {
    const session = await SessionModel.create({ user: userId });
    return session.toJSON();
  } catch (error) {
    console.log(error);
    throw new Error("Invalid Session");
  }
}

export function createAccessToken(
  user,
  p_session,
) {
  const accessToken = generateTokenByJwt(
    { ...user, session: p_session._id },
    {
      expiresIn: "5m"
    }
  );
  return accessToken;
}

export const reIssueAccessToken = async (refreshToken) => {
  try {
    const { decode } = await decodeTokenByJwt(refreshToken);
    if (!decode || (!get(decode, '_id'))) return false;
    const id = get(decode, "_id");
    const my_session = await SessionModel.findById(id);
    if (!my_session || !my_session.valid) return false;
    const user = await findUserService({ _id: my_session.user });
    if (!user) return false;
    const accessToken = createAccessToken(user, my_session);

    return accessToken;
  } catch (error) {
    return false;
  }
}

export const updateSessionService = async (query, update) => {
  try {
    const result = await SessionModel.updateMany(query, update);
    return result;
  } catch (error) {
    console.error("Error updating session:", error);
    return false;
    // throw new Error("Failed to update session");
  }
};

export const findSession = async (query) => {
  try {
    const result = await SessionModel.findOne(query);
    return result;
  } catch (error) {
    console.error("Error finding session:", error);
    throw new Error("Failed to find session");
  }
};

