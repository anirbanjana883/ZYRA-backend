import express from "express"
import isAuth from "../middlewares/isAuth.js"
import { deleteNotification, editProfile, follow, followingList, getAllNotifications, getCurrentUser, getLastSeen, getProfile, markAllAsRead, markAsRead, search, suggestedUser } from "../controllers/user.controllers.js"
import {upload} from "../middlewares/multer.js"
const userRouter = express.Router()

userRouter.get("/current",isAuth,getCurrentUser)
userRouter.get("/suggested",isAuth,suggestedUser)
userRouter.get("/getProfile/:userName",isAuth,getProfile)
userRouter.post("/editProfile",isAuth,upload.single("profileImage"),editProfile)
userRouter.post("/follow/:targetUserId",isAuth,follow)
userRouter.get("/followingList",isAuth,followingList)
userRouter.get("/search",isAuth,search)
userRouter.get("/getAllNotifications",isAuth,getAllNotifications)
userRouter.get("/markAsRead/:notificationId",isAuth,markAsRead)
userRouter.put("/markAllAsRead", isAuth, markAllAsRead); 
userRouter.delete("/deleteNotification/:notificationId", isAuth, deleteNotification);
userRouter.get("/lastSeen/:userId", isAuth, getLastSeen);

export default userRouter
