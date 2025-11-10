import lodash from "lodash";
import { createSessionService, findSession, reIssueAccessToken, updateSessionService } from "../service/session.service.js";
import { findUserService, validatePasswordLoginService } from "../service/user.service.js";
import { decodeTokenByJwt, generateTokenByJwt } from "../utils/utils.jwt.js";
import sendMailService from "../service/selfMainServices/sendMail.service.js";
import UserModel from "../model/user.model.js";
import SessionModel from "../model/session.model.js";
import jwt from "jsonwebtoken";

const {
    get
} = lodash;
export const createUserSessionHandler = async (req, res) => {
    try {
        const checkUser = await findUserService({ email: req?.body?.email });
        if (!checkUser) {
            return res.status(400).json({
                error: "No User Found !!"
            });
        }

        const user = await validatePasswordLoginService(req.body);
        if (!user) {
            return res.status(400).json({
                error: "Invalid Info"
            });
        }

        let existSession = await findSession({ user: user._id, valid: true });
        if (existSession) {
            existSession = existSession.toObject ? existSession.toObject() : existSession;
        }
        let session;

        if (existSession?.valid) {
            session = existSession;
        } else {
            const newSession = await createSessionService(user._id);
            session = newSession.toObject ? newSession.toObject() : newSession;
        }
        // await sendMailService();

        const accessToken = await generateTokenByJwt({ ...user, session: session._id, id: 1 }, {
            expiresIn: "5m"
        });

        const refreshToken = await generateTokenByJwt(session, {
            expiresIn: "7d"
        });

        // const userIpAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const decode = await decodeTokenByJwt(accessToken);
        const my_user = decode.decode;
        return res.status(200).json({
            accessToken,
            refreshToken,
            my_user,
            message: "Login Successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(404).json({
            error: error.message || "An error occurred"
        });
    }
};

export const getSessionHandler = async (req, res) => {
    try {
        const accessToken = get(req, "headers.authorization", "").replace(
            /^Bearer\s/,
            ""
        );
        const { decode, expired } = decodeTokenByJwt(accessToken);
        if (decode && !expired) {
            const session = await findSession({
                user: decode._id
            });
            return res.json(session).status(200);
        }
        else {
            return res.json({
                "error": "Invalid Session"
            }).status(400);
        }
    } catch (error) {
        return res.json({ error: `${error}` }).status(500);
    }
}



export const updateSessionHandler = async (req, res) => {
    try {
        const session = await updateSessionService({ user: req.user._id }, { valid: false });
        if (!session) return res.json({error : "Invalid Session"}).status(400);
        return res.json({ message: "Logout Successfully", session });
    } catch (error) {
        console.log(error);
        console.log({ 'error': error.message }).status(400);
    }
}

// Re Issue Access Token Controler
export const reIssueAccessTokenSessionHandler = async (req, res) => {
    try {
        const { refreshToken } = get(req, "body");

        if (!refreshToken) {
            return res.status(401).json({ error: "Refresh Token is required" });
        }

        const SECRET = process.env.JWT_SECRET;
        if (!SECRET) {
            return res.status(500).json({ error: "JWT_SECRET not configured in env" });
        }

        // FIXED ✅ no hardcoded secret
        const tk = jwt.verify(refreshToken, SECRET);

        const accessToken = await reIssueAccessToken(refreshToken);
        const decode = await decodeTokenByJwt(accessToken);
        const my_user = decode.decode;

        if (accessToken && my_user) {
            return res.status(200).json({
                message: "Access Token Generated Successfully!",
                accessToken,
                my_user,
            });
        } else {
            return res.json({ error: "Invalid Session" });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};



