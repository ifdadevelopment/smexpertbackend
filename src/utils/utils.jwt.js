import jwt from "jsonwebtoken";

const generateTokenByJwt = async (data, option = undefined) => {
    try{
        if (typeof data !== 'object' || data === null) {
            throw new Error('Payload must be a valid object.');
        }
        else{
            return jwt.sign(data, 'munna_bahi_private_key', {...option, algorithm: "HS256" });
        }
    }
    catch (error){
        throw new Error("Login Failed");
    }
}

const decodeTokenByJwt = async (token) => {
    try {
        const decode = jwt.verify(token, 'munna_bahi_private_key');
        return {
            expired: false,
            valid: true,
            decode
        }
    } catch (error) {
        console.log("JWT Error");
        console.log(error);
        return {
            expired: true,
            valid: false,
            decode: null
        }
    }
}

export { generateTokenByJwt, decodeTokenByJwt };