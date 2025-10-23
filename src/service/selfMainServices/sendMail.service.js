import transpoter from "./mail.service.js";

const sendMailService = async ( user_email=null, sub = null )=>{
    const data = {};
    const random_num = Math.floor(Math.random() * 1000000);
    const mailOptions = {
        from : "positive.mind.123456789@gmail.com",
        to : 'manojrawat87634@gmail.com',
        subject : `Otp for Munna Password ${random_num}`,
        text : `Otp for Munna Password ${random_num}`,
    }
    data[user_email] = random_num;

    setTimeout(() => {
        data[user_email] = ''
    }, 1000 * 60 * 5);

    transpoter.sendMail({...mailOptions, html : "<h1> Helllo World"}, (error, info)=>{
        if (error){
            throw new Error("Email Auth Failed");
        }
        console.log("Email Send Successfully");
    });
}

export default sendMailService;