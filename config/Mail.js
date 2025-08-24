import nodeMailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodeMailer.createTransport({
  service: "Gmail",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async (to, otp) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL,
      to,
      subject: "Your OTP for Password Reset",
      html: `
  <div style="font-family: Arial, sans-serif; font-size: 16px; color: #333;">
    <p>Hi,</p>
    <p>Your OTP for resetting your password is:</p>
    <p style="font-size: 20px; font-weight: bold; color: #000;">${otp}</p>
    <p>This OTP is valid for <strong>5 minutes</strong>.</p>
    <p>If you didn't request this, you can ignore this email.</p>
    <br>
    <p>– Zyra Team</p>
  </div>`,
    });

    console.log("Email sent: ", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export default sendMail;
