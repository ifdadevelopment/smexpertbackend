import yup, { object, string } from "yup";

const topicsSupportSchema = yup.object().shape({
    body : object({
            topicId : yup.string()
            .matches(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
            .required('Topic Id is required'),
        desc : yup.string().required("This field is required"),
        mediaUrl : yup.string().url()
    }),
});

export default topicsSupportSchema;