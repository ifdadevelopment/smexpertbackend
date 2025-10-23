import yup, { object, string } from "yup";

const questionSchema = yup.object().shape({
    body: object({
        title: string()
            .max(200)
            .required("Title is required"),
        categorieId: yup.string()
            .matches(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
            .required('Categoery is required'),
        topicId: yup.string()
            .matches(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format')
            .required('Categoery is required'),
        desc: yup.string().required("This field is required"),
    }),
});

export default questionSchema;