import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("❌ JWT_SECRET is not defined in environment variables!");
}

const generateTokenByJwt = async (data, option = undefined) => {
  if (typeof data !== "object" || data === null) {
    throw new Error("Payload must be a valid object.");
  }
  return jwt.sign(data, SECRET, { ...option, algorithm: "HS256" });
};

const decodeTokenByJwt = async (token) => {
  try {
    const decode = jwt.verify(token, SECRET);
    return { expired: false, valid: true, decode };
  } catch (error) {
    console.log("JWT Error:", error.message);
    return { expired: true, valid: false, decode: null };
  }
};

export { generateTokenByJwt, decodeTokenByJwt };

