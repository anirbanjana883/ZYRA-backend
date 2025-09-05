import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { editProfile, follow, followingList, getAllNotifications, getCurrentUser, getProfile, markAsRead, search, suggestedUser } from "../controllers/user.controllers.js"
import {upload} from "../middlewares/multer.js"
const userRouter = express.Router()

userRouter.get("/current",isAuth,getCurrentUser)
userRouter.get("/suggested",isAuth,suggestedUser)
userRouter.get("/getProfile/:userName",isAuth,getProfile)
userRouter.post("/editProfile",isAuth,upload.single("profileImage"),editProfile)
userRouter.get("/follow/:targetUserId",isAuth,follow)
userRouter.get("/followingList",isAuth,followingList)
userRouter.get("/search",isAuth,search)
userRouter.get("/getAllNotifications",isAuth,getAllNotifications)
userRouter.get("/markAsRead/:notificationId",isAuth,markAsRead)

export default userRouter
