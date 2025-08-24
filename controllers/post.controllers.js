import uploadOnCloudinary from "../config/cloudinary.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";

// Upload Post Controller
export const uploadPost = async (req, res) => {
  try {
    const { caption, mediaType } = req.body;
    let media;
    if (req.file) {
      media = await uploadOnCloudinary(req.file.path);
    } else {
      res.status(400).json({ error: "No file uploaded" });
    }
    const post = await Post.create({
      caption,
      media,
      mediaType,
      author: req.userId,
    });

    const populatedPost = await Post.findById(post._id).populate(
      "author",
      "name userName profileImage"
    );

    return res.status(201).json(populatedPost);
  } catch (err) {
    console.error("Error in uploadPost:", err);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
};

// Get All Posts for Logged In User
export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find({})
      .populate("author", "name userName profileImage")
      .populate("comments.author", "name userName profileImage")
      .sort({ createdAt: -1 });

    return res.status(200).json(posts);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Get all posts error: ${error.message}` });
  }
};

// Like/Unlike Post
export const like = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.userId.toString();

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const alreadyLiked = post.likes.some((id) => id.toString() === userId);

    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    await post.populate("author", "name userName profileImage");
    await post.populate("comments.author", "name userName profileImage");

    return res.status(200).json(post);
  } catch (error) {
    console.error("Like post error:", error);
    return res
      .status(500)
      .json({ message: `Like post error: ${error.message}` });
  }
};

// Comment on Post
export const comment = async (req, res) => {
  try {
    const { message } = req.body;
    const postId = req.params.postId;

    if (!message) {
      return res.status(400).json({ message: "Comment message is required" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    post.comments.push({
      author: req.userId,
      message,
    });

    await post.save();

    await post.populate("author", "name userName profileImage");
    await post.populate("comments.author", "name userName profileImage");

    return res.status(200).json(post);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `Comment in post error: ${error.message}` });
  }
};

// Save / Unsave Post

export const savedPosts = async (req, res) => {
  try {
    const postId = req.params.postId;
    const user = await User.findById(req.userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const alreadySaved = user.saved.some(id => id.toString() === postId.toString());

    if (alreadySaved) {
      user.saved = user.saved.filter(id => id.toString() !== postId.toString());
    } else {
      user.saved.push(postId);
    }

    await user.save();

    // Return the FULL updated user, with saved posts and their authors populated
    const updatedUser = await User.findById(req.userId)
      .select("-password")
      .populate([
        // saved posts + their authors + commenters
        {
          path: "saved",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
          ],
        },
        // followers/following thumbnails if you need them
        { path: "followers", select: "name userName profileImage" },
        { path: "following", select: "name userName profileImage" },
        // (optional) also keep posts populated consistently
        {
          path: "posts",
          populate: [
            { path: "author", select: "name userName profileImage" },
            { path: "comments.author", select: "name userName profileImage" },
          ],
        },
      ]);

    return res.status(200).json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: `Save post error: ${error.message}` });
  }
};
