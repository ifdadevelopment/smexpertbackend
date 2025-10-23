import yup, { object, string } from "yup";

const postSchemaObj = {
    body: object({
        my_title: string().required("Post Title Is required"),
        my_desc: string().required("Post Description is reqired")
    })
}

const MyParamsSchema = {
    params : object({
        postId : string().required("My Id is required")
    })
} 


const postMySchema = yup.object().shape({
    ...postSchemaObj
});


const updateMySchema = yup.object().shape({
    ...postSchemaObj,
    ...MyParamsSchema
});

const deleteMySchema = yup.object().shape({
    ...MyParamsSchema
});


export { 
    updateMySchema, 
    postMySchema, 
    deleteMySchema 
};