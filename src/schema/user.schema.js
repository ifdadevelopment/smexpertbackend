// schema/user.schema.js  (replace your register schema)
import yup, { object, ref, string } from "yup";

const userLoginSchema = yup.object().shape({
  body: object({
    email: string().required("Email is required"),
    password: string().required("Password is required"),
  }),
});

const userRegisterSchema = yup.object().shape({
  body: object({
    email: string().required("Email Is required"),
    name: string().required("User name is required"),
    branchId: string().nullable(),
    branchName: string().nullable(),
    branchCode: string().nullable(),
    profession: string(),
    profileImage: string(),
    password: string().required("This field is required"),
    confirmPassword: string().oneOf([ref("password")], "Confirm Password must same"),
  }).test(
    "branchId-or-branchName",
    "Either branchId or branchName is required",
    (val) => !!(val.branchId || val.branchName)
  ),
});

export { userLoginSchema, userRegisterSchema };
