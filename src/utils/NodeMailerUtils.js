import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: true,
  },
});
console.log("🔍 NODE_ENV:", process.env.NODE_ENV);
console.log("🔍 MAIL_USER:", process.env.MAIL_USER);

transporter.verify((err, success) => {
  if (err) console.error("❌ SMTP verification failed:", err.message);
  else console.log("✅ SMTP server ready");
});

// export const sendResetPasswordEmail = async (toEmail, resetToken) => {
//   try {
//     if (!toEmail) throw new Error("Recipient email not provided");
//     if (!resetToken) throw new Error("Reset token missing");

//     const frontendUrl =
//       process.env.NODE_ENV === "production"
//         ? process.env.CLIENT_URL_PROD || "smexpert://reset-password"
//         : process.env.CLIENT_URL_DEV || "smexpert://reset-password";

//     const resetUrl = `${frontendUrl}?token=${encodeURIComponent(resetToken)}`;

//     const htmlTemplate = `
//   <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
//     <div style="background-color: #f4f4f4; padding: 20px; border-radius: 8px;">
//       <h2 style="color: #1e76cd; text-align: center; font-size: 24px;">Password Reset Request</h2>
//       <p style="font-size: 16px; color: #555;">We received a request to reset your password. Please click the button below to reset it:</p>
//       <div style="text-align: center; margin-top: 20px;">
//         <a href="${resetUrl}" style="background-color: #1e76cd; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block;">Reset Your Password</a>
//       </div>
//       <p style="font-size: 14px; color: #777; text-align: center; margin-top: 20px;">If you did not request this password reset, please ignore this email.</p>
//       <p style="font-size: 12px; color: #aaa; text-align: center; margin-top: 40px;">This email was sent by Banaras Digital Solution.</p>
//     </div>
//   </div>
// `;

//     const mailOptions = {
//       from: `"Banaras Digital Solution" <${process.env.MAIL_USER}>`,
//       to: toEmail,
//       subject: "Password Reset Instructions",
//       html: htmlTemplate,
//     };

//     const info = await transporter.sendMail(mailOptions);
//     console.log(`✅ Reset email sent to ${toEmail} → ${resetUrl}`);
//     return info;
//   } catch (err) {
//     console.error("❌ sendResetPasswordEmail error:", err.message);
//     throw new Error(err.message);
//   }
// };
export const sendResetPasswordEmail = async (toEmail, otp) => {
  try {
    if (!toEmail) throw new Error("Recipient email not provided");
    if (!otp) throw new Error("OTP missing");

    const htmlTemplate = `
    <div style="font-family: Poppins, Arial, sans-serif; background:#f5f7fa; padding:30px 0;">
      <div style="max-width:500px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="background:#0A1F44; padding:18px; text-align:center;">
          <h2 style="color:#fff; margin:0; font-size:22px; letter-spacing:1px; font-weight:600;">
            NKD AND ASSOCIATES
          </h2>
        </div>

        <!-- Body -->
        <div style="padding:26px 32px; color:#333;">
          <h3 style="color:#0A1F44; margin-bottom:8px; font-size:18px;">Password Reset Request</h3>

          <p style="font-size:15px; line-height:1.6; margin:0 0 20px 0; color:#444;">
            We received a request to reset your account password. Please use the OTP below to proceed with resetting your password securely.
          </p>

          <!-- ✅ Only Raw OTP Number Now -->
          <div style="text-align:center; margin:20px auto; font-size:25px; font-weight:semibold; color:#0A1F44;">
            ${otp}
          </div>

          <p style="font-size:14px; margin:18px 0 10px 0; color:#222;">
            ⏳ This OTP is valid for <b>10 minutes</b>. Please do not share it with anyone.
          </p>

          <div style="background:#f8f8f8; padding:12px; border-left:4px solid #0A1F44; border-radius:4px;">
            <p style="font-size:13px; margin:0; color:#555; line-height:1.5;">
              If you did not request this password reset, please ignore this email or contact NKD AND ASSOCIATES support immediately.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f0f2f5; padding:18px; text-align:center; font-size:12px; color:#666;">
          <p style="margin:4px 0;">© ${new Date().getFullYear()} NKD AND ASSOCIATES. All Rights Reserved.</p>
        </div>

      </div>
    </div>
    `;

    const mailOptions = {
      from: `"NKD AND ASSOCIATES" <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: "Your Password Reset OTP",
      html: htmlTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail}`);
    return info;
  } catch (err) {
    console.error("sendResetPasswordEmail error:", err.message);
    throw err;
  }
};


