import express from "express"
import dotenv from "dotenv"
import connectDb from "./config/db.js"
import cookieParser from "cookie-parser"
import cors from "cors"
import authRouters from "./routes/auth.routes.js"
import userRouters from "./routes/user.routes.js"
import postRouters from "./routes/post.routes.js"
import loopRouters from "./routes/loop.routes.js"
import storyRouters from "./routes/story.routes.js"
import messageRouter from "./routes/message.routes.js"

dotenv.config();

const app = express()
const port = process.env.PORT || 5000

app.use(cors({
    origin:"http://localhost:5173",
    credentials : true
}))
app.use(express.json())
app.use(cookieParser())

app.use("/api/auth",authRouters)
app.use("/api/user",userRouters)
app.use("/api/post",postRouters)
app.use("/api/loop",loopRouters)
app.use("/api/story",storyRouters)
app.use("/api/message",messageRouter)

app.listen(port,()=>{
    connectDb()
    console.log(`server listning at  at ${port}`) ;
})

