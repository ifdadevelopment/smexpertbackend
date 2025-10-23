import yup, { object, string } from "yup";

const topicsSchema = yup.object().shape({
    body : object({
        title : string()
            .max(200)
            .required("Title is required"),

            categories : yup.string()
            .matches(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
            .required('Categoery is required'),
        desc : yup.string().required("This field is required"),
        mediaUrl : yup.string().url().required("Media Url is required Field")
    }),
});



export default topicsSchema;