import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { editProfile, follow, followingList, getCurrentUser, getProfile, suggestedUser } from "../controllers/user.controllers.js"
import {upload} from "../middlewares/multer.js"
const userRouter = express.Router()

userRouter.get("/current",isAuth,getCurrentUser)
userRouter.get("/suggested",isAuth,suggestedUser)
userRouter.get("/getProfile/:userName",isAuth,getProfile)
userRouter.post("/editProfile",isAuth,upload.single("profileImage"),editProfile)
userRouter.get("/follow/:targetUserId",isAuth,follow)
userRouter.get("/followingList",isAuth,followingList)

export default userRouter
