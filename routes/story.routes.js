import express from "express";
import isAuth from "../middlewares/isAuth.js";
import { uploadStory, getStoryByUserName, viewStory, getAllStories } from "../controllers/story.controllers.js";
import { upload } from "../middlewares/multer.js";

const storyRouter = express.Router();

storyRouter.post("/upload", isAuth, upload.single("media"), uploadStory);
storyRouter.get("/getByUserName/:userName", isAuth, getStoryByUserName);
storyRouter.get("/getAll", isAuth, getAllStories);
storyRouter.get("/view/:storyId", isAuth, viewStory);

export default storyRouter;
