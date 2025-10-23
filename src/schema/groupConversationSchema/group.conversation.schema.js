import * as yup from "yup";

const groupSchema = yup.object().shape({
    body: yup.object({
        name: yup
            .string()
            .required("Group name is required")
            .max(100, "Group name cannot exceed 100 characters"),
        members: yup
            .array()
            .of(
                yup
                    .string()
                    .matches(/^[0-9a-fA-F]{24}$/, "Invalid member ID format")
            )
            .min(2, "At least two members are required")
            .required("Members are required"),
        branchName: yup
            .string()
            .required("Branch name is required")
    }),
});


export default groupSchema;