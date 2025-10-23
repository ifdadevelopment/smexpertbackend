import yup, { object, ref, string } from "yup";


const chatBotSchema = yup.object().shape({
    body: object({
        user_prompt : string().required("User Prompt is required")
    })
});

export default chatBotSchema;