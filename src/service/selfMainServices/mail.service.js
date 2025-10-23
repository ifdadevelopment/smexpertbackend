import nodemailer from 'nodemailer';

const transpoter = nodemailer.createTransport({
    host : 'smtp.gmail.com',
    port : 465,
    secure : true,
    auth : {
        user : 'otp@simply2cloud.com',
        pass : "dsveoqolbfkuporu"
    }
});

export default transpoter;