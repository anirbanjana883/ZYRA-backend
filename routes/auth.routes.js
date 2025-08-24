import express from "express";
import {
  signIn,
  signOut,
  signUp,
  sendOtp,
  verifyOtp,
  resetPassword
} from "../controllers/auth.controllers.js";

const authRouter = express.Router();

authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);
authRouter.post("/sendotp", sendOtp);
authRouter.post("/verifyotp", verifyOtp);
authRouter.post("/resetpassword", resetPassword);
authRouter.get("/signout", signOut); 

export default authRouter;
