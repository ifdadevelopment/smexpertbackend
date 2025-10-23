import lodash from "lodash";
import { decodeTokenByJwt } from "../utils/utils.jwt.js";

const { get } = lodash;

const deserializeUser = async (req, res, next) => {
  const accessToken = get(req, "headers.authorization", "").replace(
    /^Bearer\s/,
    ""
  );
  if (!accessToken) return next();
  const data = await decodeTokenByJwt(accessToken);
  const decode = data.decode;
  if (decode) {
    req.user = decode;
    return next();
  }
  next();
}

export default deserializeUser;