import Loop from "../models/loop.model.js";
import uploadOnCloudinary from "../config/cloudinary.js";
import User from "../models/user.model.js";
import { io } from "../socket.js";


// upload loop Controller
export const uploadLoop = async (req, res) => {
  try {
    const { caption } = req.body;

    let media;
    if (req.file) {
      media = await uploadOnCloudinary(req.file.path); 
    } else {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const loop = await Loop.create({
      caption,
      media,
      author: req.userId,
    });

    const user = await User.findById(req.userId);
    user.loops.push(loop._id);
    await user.save();

    const populatedLoop = await Loop.findById(loop._id).populate(
      "author",
      "name userName profileImage"
    );

    return res.status(201).json(populatedLoop);
  } catch (err) {
    console.error("Error in uploadLoop:", err);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
};

// Get All loop for Logged In User
export const getAllLoops = async (req, res) => {
  try {
    const loops = await Loop.find({})
      .populate("author", "name userName profileImage")
      .populate("comments.author")
      .sort({ createdAt: -1 });

    return res.status(200).json(loops);
  } catch (error) {
    console.error("Get all loops error:", error);
    return res
      .status(500)
      .json({ message: `Get all loops error: ${error.message}` });
  }
};

// like unlike loop
export const like = async (req, res) => {
  try {
    const loopId = req.params.loopId;
    const loop = await Loop.findById(loopId);

    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    const userId = req.userId.toString();

    const alreadyLiked = loop.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      loop.likes = loop.likes.filter((id) => id.toString() !== userId);
    } else {
      loop.likes.push(userId);
    }

    await loop.save();

    await loop.populate("author", "name userName profileImage");

    io.emit("likedLoop",{
      loopId:loop._id,
      likes:loop.likes
    })

    return res.status(200).json(loop);
  } catch (error) {
    console.error("Like loop error:", error);
    return res
      .status(500)
      .json({ message: `Like loop error: ${error.message}` });
  }
};

// comment on loop
export const comment = async (req, res) => {
  try {
    const { message } = req.body;
    const loopId = req.params.loopId;

    const loop = await Loop.findById(loopId);

    if (!loop) {
      return res.status(404).json({ message: "Loop not found" });
    }

    loop.comments.push({
      author: req.userId,
      message,
    });

    await loop.save();

    await loop.populate("author", "name userName profileImage");
    await loop.populate("comments.author", "name userName profileImage");
    io.emit("commentedLoop",{
      loopId:loop._id,
      comments:loop.comments
    })

    return res.status(200).json(loop);
  } catch (error) {
    console.error("Comment in loop error:", error);
    return res
      .status(500)
      .json({ message: `Comment in loop error: ${error.message}` });
  }
};
