import User from "../models/user.model.js"
import bcrypt from "bcryptjs"
import genToken from "../config/token.js"
import sendMail from "../config/Mail.js"

// sign up controller

export const signUp = async (req , res)=>{
    try{
        const {name,email,password,userName} = req.body
        // finding by email
        const findByEmail = await User.findOne({email});
        // same user  found
        if(findByEmail){
            return res.status(400).json({message:"Email already exists !"})
        }

        // finding by user name 
        const findByUserName = await User.findOne({userName});
        // same user  found
        if(findByUserName){
            return res.status(400).json({message:"User already exists !"})
        }

        if(password.length < 6){
            return res.status(400).json({message:"Password must contain atleast 6 charracters !"})
        }
        // now create user 

        // hashing passwod 
        const hashedPassword = await bcrypt.hash(password,10)
        const user = await User.create({
            name,
            userName,
            email,
            password : hashedPassword
        })
        // token generation
        const token = await genToken(user._id)
        // store in cookie
        res.cookie("token",token,{
            httpOnly : true,
            maxAge : 10 * 365 * 24 * 60 * 60 * 1000 , 
            secure : false,
            sameSite : "Strict"
        })

        return res.status(201).json(user)
    }catch(error){
        return res.status(500).json({message:`Signup Error  !${error}`})
    }
}

// sign in controller 

export const signIn = async (req , res)=>{
    try{
        // sign in by username and password 
        const {password,userName} = req.body

        // finding by user name 
        const user = await User.findOne({userName});
        // same user  found
        if(!user){
            return res.status(400).json({message:"User not found !"})
        }

        // matching password
        const isMatch = await bcrypt.compare(password,user.password)

        if(!isMatch){
            return res.status(400).json({message:"Incorrect Password !"})
        }
        // token generation
        const token = await genToken(user._id)


        // store in cookie
        res.cookie("token",token,{
            httpOnly : true,
            maxAge : 10 * 365 * 24 * 60 * 60 * 1000 , 
            secure : false,
            sameSite : "Strict"
        })

        return res.status(200).json(user)
    }catch(error){
        return res.status(500).json({message:`Signin Error  !${error}`})
    }
}

// signout controller 

export const signOut = async (req , res)=>{
    try{
       res.clearCookie("token")
       res.status(200).json({message:`Sign out successfully`})
    }catch(error){
        return res.status(500).json({message:`Signout Error  !${error}`})
    }
}
// otp sending controller
export const sendOtp =  async (req,res)=>{
    try{
        const {email}= req.body
        const user = await User.findOne({email})
        if(!user){
            return res.status(400).json({message : "User not found"})
        }
        const otp = Math.floor(1000 + Math.random() * 9000).toString()

        user.resetOtp = otp,
        user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); 
        user.isOtpVerified = false

        await user.save()

        await sendMail(email,otp)

        return res.status(200).json({ message: "Email sent successfully" });
    }catch(error){
        return res.status(500).json({message:`Sent otp error  !${error}`})
    }
}

// otp verifying controller
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.resetOtp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP!" });
    }

    user.isOtpVerified = true;
    user.resetOtp = undefined;
    user.otpExpires = undefined;

    await user.save();
    return res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    return res.status(500).json({ message: `Verify OTP error: ${error.message}` });
  }
};

// reset otp controller

export const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.isOtpVerified) {
      return res.status(400).json({ message: "OTP verification required before resetting password." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.isOtpVerified = false;

    await user.save();
    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    return res.status(500).json({ message: `Reset password error: ${error.message}` });
  }
};
